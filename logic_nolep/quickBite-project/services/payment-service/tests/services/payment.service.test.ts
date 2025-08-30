import { test, expect, describe, beforeEach, mock, spyOn } from "bun:test";
import { PaymentService } from "../../src/services/payment.service";
import { StripeService } from "../../src/services/stripe.service";
import type { Database } from "../../src/db/client";

// Mock the validation utilities
const mockValidateAmount = mock(() => true);
const mockSanitizeAmount = mock((amount: number) => Math.round(amount * 100) / 100);

// Mock validation module
mock.module("../../src/utils/validation", () => ({
   validateAmount: mockValidateAmount,
   sanitizeAmount: mockSanitizeAmount
}));

// Mock fetch for external API calls
global.fetch = mock(() => Promise.resolve({
   ok: true,
   json: () => Promise.resolve({ id: 'order-123', customerId: 'user-123' })
})) as any;

describe('PaymentService', () => {
   let paymentService: PaymentService;
   let mockDb: any;
   let mockStripeService: any;

   const createMockDatabase = () => {
      let mockQueryResult: any[] = [];
      let queryBehavior: 'default' | 'empty' | 'custom' = 'default';
      let customResults: any[] = [];

      const setQueryResult = (data: any[]) => {
         mockQueryResult = [...data];
      };

      const setQueryBehavior = (behavior: 'default' | 'empty' | 'custom', results?: any[]) => {
         queryBehavior = behavior;
         if (results) customResults = [...results];
      };

      // Create a simple async function that returns the appropriate array
      const executeQuery = async (): Promise<any[]> => {
         if (queryBehavior === 'empty') return [];
         if (queryBehavior === 'custom') return [...customResults];
         return [...mockQueryResult];
      };

      // Mock the full query chain with proper async behavior
      const createQueryChain = () => {
         const query = {
            from: mock(() => ({
               where: mock(() => {
                  const wherePromise = executeQuery();
                  // Add limit method to the promise for chaining
                  (wherePromise as any).limit = mock(() => executeQuery());
                  return wherePromise;
               })
            })),
            where: mock(() => {
               const wherePromise = executeQuery();
               (wherePromise as any).limit = mock(() => executeQuery());
               return wherePromise;
            })
         };
         return query;
      };

      const mockSelect = mock(() => createQueryChain());

      // Mock update operations
      const mockReturning = mock(async () => {
         return mockQueryResult.length > 0 ? [mockQueryResult[0]] : [];
      });

      const mockUpdateWhere = mock(() => ({
         returning: mockReturning
      }));

      const mockSet = mock(() => ({
         where: mockUpdateWhere
      }));

      const mockUpdate = mock(() => ({
         set: mockSet
      }));

      // Mock insert operations
      const mockInsertValues = mock(() => ({
         returning: mockReturning
      }));

      const mockInsert = mock(() => ({
         values: mockInsertValues
      }));

      return {
         select: mockSelect,
         insert: mockInsert,
         update: mockUpdate,
         // Test helpers
         setQueryResult,
         setQueryBehavior,
         getQueryResult: () => [...mockQueryResult],
         // Expose mocks for assertion
         mockReturning,
         mockSet,
         mockInsertValues
      };
   };

   beforeEach(() => {
      mockDb = createMockDatabase();

      // Mock StripeService
      mockStripeService = {
         createPaymentIntent: mock(() => Promise.resolve({
            id: 'pi_test123',
            client_secret: 'pi_test123_secret_test',
            amount: 1000,
            currency: 'usd',
            status: 'requires_payment_method'
         })),
         createCheckoutSession: mock(() => Promise.resolve({
            id: 'cs_test123',
            payment_intent: 'pi_test123',
            url: 'https://checkout.stripe.com/pay/cs_test123',
            customer_email: 'test@example.com'
         })),
         createPaymentLink: mock(() => Promise.resolve({
            id: 'plink_test123',
            url: 'https://buy.stripe.com/test_123'
         })),
         createTransfer: mock(() => Promise.resolve({
            id: 'tr_test123',
            amount: 1000,
            destination: 'acct_test123'
         }))
      };

      // Mock the StripeService methods
      spyOn(StripeService.prototype, 'createPaymentIntent').mockImplementation(mockStripeService.createPaymentIntent);
      spyOn(StripeService.prototype, 'createCheckoutSession').mockImplementation(mockStripeService.createCheckoutSession);
      spyOn(StripeService.prototype, 'createPaymentLink').mockImplementation(mockStripeService.createPaymentLink);
      spyOn(StripeService.prototype, 'createTransfer').mockImplementation(mockStripeService.createTransfer);

      paymentService = new PaymentService(mockDb as Database);

      // Reset validation mocks
      mockValidateAmount.mockReturnValue(true);
      mockSanitizeAmount.mockImplementation((amount) => Math.round(amount * 100) / 100);
   });

   describe('createPayment', () => {
      test('should create payment successfully', async () => {
         const paymentData = {
            orderId: 'order-123',
            amount: '10.00',
            currency: 'USD',
            paymentMethod: 'card' as const
         };

         // Set up successful validation and sanitization
         mockValidateAmount.mockReturnValueOnce(true);
         mockSanitizeAmount.mockReturnValueOnce(10.00);

         // Set up successful payment creation result
         mockDb.setQueryResult([{
            id: 'payment-123',
            orderId: 'order-123',
            userId: 'user-123',
            amount: '10.00',
            status: 'pending'
         }]);

         const result = await paymentService.createPayment(paymentData, 'user-123');

         expect(result).toEqual({
            id: 'payment-123',
            orderId: 'order-123',
            amount: 10.00,
            status: 'pending',
            clientSecret: 'pi_test123_secret_test',
            paymentIntentId: 'pi_test123'
         });

         expect(mockStripeService.createPaymentIntent).toHaveBeenCalledWith(
            10.00,
            'USD',
            { orderId: 'order-123', userId: 'user-123' }
         );
      });

      test('should throw error for invalid amount', async () => {
         mockValidateAmount.mockReturnValueOnce(false);

         const paymentData = {
            orderId: 'order-123',
            amount: '-10.00',
            currency: 'USD',
            paymentMethod: 'card' as const
         };

         await expect(paymentService.createPayment(paymentData, 'user-123'))
            .rejects.toThrow('Invalid payment amount');
      });

      test('should throw error when order not found', async () => {
         mockValidateAmount.mockReturnValueOnce(true);
         mockSanitizeAmount.mockReturnValueOnce(10.00);

         // Mock fetch to return order not found
         global.fetch = mock(() => Promise.resolve({
            ok: false,
            json: () => Promise.resolve({})
         })) as any;

         const paymentData = {
            orderId: 'nonexistent-order',
            amount: '10.00',
            currency: 'USD',
            paymentMethod: 'card' as const
         };

         await expect(paymentService.createPayment(paymentData, 'user-123'))
            .rejects.toThrow('Order not found');
      });
   });

   describe('createPaymentWithCheckout', () => {
      test('should create checkout payment successfully', async () => {
         // Reset fetch mock to successful response
         global.fetch = mock(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'order-123', customerId: 'user-123' })
         })) as any;

         mockValidateAmount.mockReturnValueOnce(true);
         mockSanitizeAmount.mockReturnValueOnce(10.00);

         mockDb.setQueryResult([{
            id: 'payment-123',
            orderId: 'order-123',
            amount: '10.00',
            status: 'pending'
         }]);

         const paymentData = {
            orderId: 'order-123',
            amount: '10.00',
            currency: 'USD',
            paymentMethod: 'card' as const,
            successUrl: 'https://example.com/success',
            cancelUrl: 'https://example.com/cancel'
         };

         const result = await paymentService.createPaymentWithCheckout(
            paymentData,
            'user-123',
            'test@example.com'
         );

         expect(result).toEqual({
            id: 'payment-123',
            orderId: 'order-123',
            amount: 10.00,
            status: 'pending',
            clientSecret: '',
            paymentIntentId: 'pi_test123',
            paymentUrl: 'https://checkout.stripe.com/pay/cs_test123',
            sessionId: 'cs_test123'
         });
      });
   });

   describe('createPaymentLink', () => {
      test('should create payment link successfully', async () => {
         // Reset fetch mock to successful response
         global.fetch = mock(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ id: 'order-123', customerId: 'user-123' })
         })) as any;

         mockValidateAmount.mockReturnValueOnce(true);
         mockSanitizeAmount.mockReturnValueOnce(10.00);

         const paymentData = {
            orderId: 'order-123',
            amount: 10.00,
            currency: 'USD',
            paymentMethod: 'card' as const
         };

         const result = await paymentService.createPaymentLink(paymentData, 'user-123');

         expect(result).toEqual({
            paymentLinkUrl: 'https://buy.stripe.com/test_123',
            paymentLinkId: 'plink_test123'
         });
      });
   });

   describe('updatePaymentStatus', () => {
      test('should update payment status successfully', async () => {
         // Mock finding payment by payment intent ID
         mockDb.setQueryResult([{
            id: 'payment-123',
            orderId: 'order-123',
            userId: 'user-123',
            amount: '10.00',
            currency: 'USD',
            status: 'pending',
            stripePaymentIntentId: 'pi_test123',
            paymentMethod: 'card',
            metadata: null
         }]);

         const result = await paymentService.updatePaymentStatus('pi_test123', 'succeeded');

         expect(result).toBeDefined();
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.update).toHaveBeenCalled();
      });

      test('should handle payment not found gracefully', async () => {
         // Mock console methods to avoid test output noise
         const consoleSpy = spyOn(console, 'log').mockImplementation(() => { });
         const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => { });

         // Set empty results for all queries
         mockDb.setQueryBehavior('empty');

         const result = await paymentService.updatePaymentStatus('pi_nonexistent', 'succeeded');
         expect(result).toBeNull();

         // Clean up spies
         consoleSpy.mockRestore();
         consoleErrorSpy.mockRestore();
      });
   });

   describe('getPaymentByOrderId', () => {
      test('should get payment by order ID successfully', async () => {
         mockDb.setQueryResult([{
            id: 'payment-123',
            orderId: 'order-123',
            userId: 'user-123',
            amount: '10.00',
            currency: 'USD',
            status: 'succeeded',
            stripePaymentIntentId: 'pi_test123',
            paymentMethod: 'card',
            metadata: null
         }]);

         const result = await paymentService.getPaymentByOrderId('order-123');

         expect(result).toBeDefined();
         expect(result.orderId).toBe('order-123');
         expect(mockDb.select).toHaveBeenCalled();
      });

      test('should return null when payment not found', async () => {
         mockDb.setQueryBehavior('empty');

         const result = await paymentService.getPaymentByOrderId('nonexistent-order');
         expect(result).toBeNull();
      });
   });

   describe('createDriverEarning', () => {
      test('should create driver earning successfully', async () => {
         // Mock validation functions
         mockValidateAmount.mockReturnValueOnce(true);
         mockSanitizeAmount.mockReturnValueOnce(10.00); // baseEarning
         mockSanitizeAmount.mockReturnValueOnce(2.00);  // tipAmount
         mockSanitizeAmount.mockReturnValueOnce(1.00);  // bonusAmount

         // Set up successful earning creation result
         mockDb.setQueryResult([{
            id: 'earning-123',
            driverId: 'driver-123',
            orderId: 'order-123',
            totalEarning: '13.00',
            payoutStatus: 'pending'
         }]);

         const earningData = {
            driverId: 'driver-123',
            orderId: 'order-123',
            baseEarning: 10.00,
            tipAmount: 2.00,
            bonusAmount: 1.00
         };

         const result = await paymentService.createDriverEarning(earningData);

         expect(result).toEqual({
            id: 'earning-123',
            driverId: 'driver-123',
            orderId: 'order-123',
            totalEarning: 13.00,
            status: 'pending'
         });

         expect(mockDb.insert).toHaveBeenCalled();
      });

      test('should throw error for invalid base earning', async () => {
         mockValidateAmount.mockReturnValueOnce(false);

         const earningData = {
            driverId: 'driver-123',
            orderId: 'order-123',
            baseEarning: -5.00
         };

         await expect(paymentService.createDriverEarning(earningData))
            .rejects.toThrow('Invalid base earning amount');
      });
   });

   describe('createRestaurantSettlement', () => {
      test('should create restaurant settlement successfully', async () => {
         // Mock validation functions
         mockValidateAmount.mockReturnValueOnce(true);
         mockSanitizeAmount.mockReturnValueOnce(100.00); // grossAmount
         mockSanitizeAmount.mockReturnValueOnce(15.00);  // commissionAmount
         mockSanitizeAmount.mockReturnValueOnce(85.00);  // netAmount

         // Set up successful settlement creation result
         mockDb.setQueryResult([{
            id: 'settlement-123',
            restaurantId: 'restaurant-123',
            orderId: 'order-123',
            netAmount: '85.00',
            settlementStatus: 'pending'
         }]);

         const settlementData = {
            restaurantId: 'restaurant-123',
            orderId: 'order-123',
            grossAmount: 100.00,
            commissionRate: 0.15
         };

         const result = await paymentService.createRestaurantSettlement(settlementData);

         expect(result).toEqual({
            id: 'settlement-123',
            restaurantId: 'restaurant-123',
            orderId: 'order-123',
            netAmount: 85.00,
            status: 'pending'
         });

         expect(mockDb.insert).toHaveBeenCalled();
      });

      test('should throw error for invalid commission rate', async () => {
         const settlementData = {
            restaurantId: 'restaurant-123',
            orderId: 'order-123',
            grossAmount: 100.00,
            commissionRate: 1.5 // Invalid: > 1
         };

         await expect(paymentService.createRestaurantSettlement(settlementData))
            .rejects.toThrow('Commission rate must be between 0 and 1');
      });

      test('should throw error for invalid gross amount', async () => {
         mockValidateAmount.mockReturnValueOnce(false);

         const settlementData = {
            restaurantId: 'restaurant-123',
            orderId: 'order-123',
            grossAmount: -100.00,
            commissionRate: 0.15
         };

         await expect(paymentService.createRestaurantSettlement(settlementData))
            .rejects.toThrow('Invalid gross amount');
      });
   });

   describe('processDriverPayout', () => {
      test('should process driver payout successfully', async () => {
         // Mock earning record
         const mockEarning = {
            id: 'earning-123',
            driverId: 'driver-123',
            orderId: 'order-123',
            totalEarning: '15.00',
            payoutStatus: 'pending'
         };

         mockDb.setQueryResult([mockEarning]);

         const result = await paymentService.processDriverPayout('earning-123', 'acct_test123');

         expect(result).toBeDefined();
         expect(result.id).toBe('tr_test123');
         expect(mockStripeService.createTransfer).toHaveBeenCalledWith(
            15.00,
            'acct_test123',
            'USD',
            {
               earningId: 'earning-123',
               driverId: 'driver-123',
               orderId: 'order-123'
            }
         );
      });

      test('should throw error when earning not found', async () => {
         mockDb.setQueryBehavior('empty');

         await expect(paymentService.processDriverPayout('nonexistent', 'acct_test123'))
            .rejects.toThrow('Earning record not found');
      });

      test('should throw error when earning already processed', async () => {
         const mockEarning = {
            id: 'earning-123',
            payoutStatus: 'processing' // Already processed
         };

         mockDb.setQueryResult([mockEarning]);

         await expect(paymentService.processDriverPayout('earning-123', 'acct_test123'))
            .rejects.toThrow('Earning already processed');
      });
   });

   describe('processRestaurantSettlement', () => {
      test('should process restaurant settlement successfully', async () => {
         const mockSettlement = {
            id: 'settlement-123',
            restaurantId: 'restaurant-123',
            orderId: 'order-123',
            netAmount: '85.00',
            settlementStatus: 'pending'
         };

         mockDb.setQueryResult([mockSettlement]);

         const result = await paymentService.processRestaurantSettlement('settlement-123', 'acct_restaurant123');

         expect(result).toBeDefined();
         expect(result.id).toBe('tr_test123');
         expect(mockStripeService.createTransfer).toHaveBeenCalledWith(
            85.00,
            'acct_restaurant123',
            'USD',
            {
               settlementId: 'settlement-123',
               restaurantId: 'restaurant-123',
               orderId: 'order-123'
            }
         );
      });

      test('should throw error when settlement not found', async () => {
         mockDb.setQueryBehavior('empty');

         await expect(paymentService.processRestaurantSettlement('nonexistent', 'acct_restaurant123'))
            .rejects.toThrow('Settlement record not found');
      });
   });

   describe('updatePaymentStatusBySessionId', () => {
      test('should update payment status by session ID successfully', async () => {
         // Set up the scenario where first query returns empty, second finds the payment
         let queryCount = 0;
         const originalExecuteQuery = mockDb.executeQuery;

         // Override the query behavior for this specific test
         const mockExecuteQuery = async () => {
            queryCount++;
            if (queryCount === 1) {
               // First query (exact metadata match) returns empty
               return [];
            } else if (queryCount === 2) {
               // Second query (all pending payments) returns the payment
               return [{
                  id: 'payment-123',
                  orderId: 'order-123',
                  metadata: JSON.stringify({ sessionId: 'cs_test123' }),
                  status: 'pending'
               }];
            }
            return [];
         };

         // Temporarily replace the query execution
         const originalSelect = mockDb.select;
         mockDb.select = mock(() => ({
            from: mock(() => ({
               where: mock(() => {
                  const promise = mockExecuteQuery();
                  (promise as any).limit = mock(() => mockExecuteQuery());
                  return promise;
               })
            })),
            where: mock(() => {
               const promise = mockExecuteQuery();
               (promise as any).limit = mock(() => mockExecuteQuery());
               return promise;
            })
         }));

         // Set up update result
         mockDb.setQueryResult([{
            id: 'payment-123',
            orderId: 'order-123',
            status: 'succeeded'
         }]);

         const result = await paymentService.updatePaymentStatusBySessionId('cs_test123', 'succeeded', 'pi_test123');

         expect(result).toBeDefined();
         expect(mockDb.update).toHaveBeenCalled();

         // Restore original mock
         mockDb.select = originalSelect;
      });

      test('should throw error when payment not found by session ID', async () => {
         // Mock empty results for all queries
         mockDb.setQueryBehavior('empty');

         await expect(paymentService.updatePaymentStatusBySessionId('cs_nonexistent', 'succeeded'))
            .rejects.toThrow('Payment not found for session ID');
      });
   });
});