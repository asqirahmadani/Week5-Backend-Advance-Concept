import { test, expect, describe, beforeEach, mock, spyOn } from "bun:test";
import { RefundService } from "../../src/services/refund.service";
import { StripeService } from "../../src/services/stripe.service";
import type { Database } from "../../src/db/client";

// Mock fetch for external API calls
global.fetch = mock(() => Promise.resolve({
   ok: true,
   json: () => Promise.resolve({})
})) as any;

const mockDbInsert = mock();
const mockDbSelect = mock();
const mockDbUpdate = mock();

mock.module('../../src/db/client', () => ({
   db: {
      select: mockDbSelect,
      insert: mockDbInsert,
      update: mockDbUpdate
   },
   Database: {} as any
}));

type reason =
   | 'customer_request'
   | 'restaurant_cancelled'
   | 'driver_unavailable'
   | 'food_quality'
   | 'other';

type status =
   | 'processing'
   | 'succeeded'
   | 'failed'
   | 'pending';

describe('RefundService', () => {
   let refundService: RefundService;
   let mockDb: any;
   let mockStripeService: any;

   const createMockDatabase = () => {
      const mockReturning = mock(async () => {
         return [{
            id: 'refund-123',
            paymentId: 'payment-123',
            orderId: 'order-123',
            stripeRefundId: 're_test123',
            amount: '10.00',
            reason: 'customer_request',
            description: 'Customer requested refund',
            status: 'processing',
            requestedBy: 'user-123',
            processedBy: null,
            requestedAt: new Date(),
            processedAt: null
         }];
      });

      const mockUpdateReturning = mock(async () => {
         return [{
            id: 'refund-123',
            orderId: 'order-123',
            amount: '10.00',
            status: 'succeeded'
         }];
      });

      const mockInsertValues = mock(() => ({
         returning: mockReturning
      }));

      const mockUpdateWhere = mock(() => ({
         returning: mockUpdateReturning
      }));

      const mockUpdateSet = mock(() => ({
         where: mockUpdateWhere
      }));

      const mockInsert = mock(() => ({
         values: mockInsertValues
      }));

      const mockUpdate = mock(() => ({
         set: mockUpdateSet
      }));

      const mockSelect = mock(() => ({
         from: mock(() => ({
            where: mock(() => {
               const promise = Promise.resolve([]);
               (promise as any).limit = mock(() => Promise.resolve([]));
               return promise;
            })
         }))
      }));

      return {
         select: mockSelect,
         insert: mockInsert,
         update: mockUpdate,
         mockReturning,
         mockUpdateReturning,
         mockInsertValues,
         mockUpdateWhere,
         mockUpdateSet
      };
   };

   beforeEach(() => {
      mockDb = createMockDatabase();

      mockDbSelect.mockReset();
      mockDbInsert.mockReset();
      mockDbUpdate.mockReset();

      // Mock StripeService
      mockStripeService = {
         createRefund: mock(() => Promise.resolve({
            id: 're_test123',
            amount: 1000,
            currency: 'usd',
            payment_intent: 'pi_test123',
            status: 'succeeded'
         }))
      };

      spyOn(StripeService.prototype, 'createRefund').mockImplementation(mockStripeService.createRefund);

      refundService = new RefundService(mockDb as Database);
   });

   describe('createRefund', () => {
      test('should create refund successfully', async () => {
         let selectCallCount = 0;

         // Mock the select method to handle different queries
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                     // First call: get payment
                     const promise = Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]);
                     (promise as any).limit = mock(() => Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]));
                     return promise;
                  } else {
                     // Second call: get existing refunds (empty)
                     return Promise.resolve([]);
                  }
               })
            }))
         }));

         const refundData = {
            orderId: 'order-123',
            amount: 10.00,
            reason: 'customer_request' as const,
            description: 'Customer requested refund',
            requestedBy: 'user-123'
         };

         const result = await refundService.createRefund(refundData);

         expect(result).toEqual({
            id: 'refund-123',
            orderId: 'order-123',
            amount: 10.00,
            status: 'processing',
            refundId: 're_test123'
         });

         expect(mockStripeService.createRefund).toHaveBeenCalledWith(
            'pi_test123',
            10.00,
            'requested_by_customer',
            {
               orderId: 'order-123',
               requestedBy: 'user-123'
            }
         );
      });

      test('should create full refund when amount not specified', async () => {
         let selectCallCount = 0;

         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                     const promise = Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]);
                     (promise as any).limit = mock(() => Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]));
                     return promise;
                  } else {
                     return Promise.resolve([]);
                  }
               })
            }))
         }));

         const refundData = {
            orderId: 'order-123',
            reason: 'customer_request' as const,
            requestedBy: 'user-123'
         };

         const result = await refundService.createRefund(refundData);

         expect(result).toBeDefined();
         expect(mockStripeService.createRefund).toHaveBeenCalledWith(
            'pi_test123',
            10.00,
            'requested_by_customer',
            expect.any(Object)
         );
      });

      test('should throw error when payment not found', async () => {
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  const promise = Promise.resolve([]);
                  (promise as any).limit = mock(() => Promise.resolve([]));
                  return promise;
               })
            }))
         }));

         const refundData = {
            orderId: 'nonexistent-order',
            reason: 'customer_request' as const,
            requestedBy: 'user-123'
         };

         await expect(refundService.createRefund(refundData))
            .rejects.toThrow('Payment not found for this order');
      });

      test('should throw error when payment not succeeded', async () => {
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  const promise = Promise.resolve([{
                     id: 'payment-123',
                     orderId: 'order-123',
                     status: 'pending',
                     stripePaymentIntentId: 'pi_test123'
                  }]);
                  (promise as any).limit = mock(() => Promise.resolve([{
                     id: 'payment-123',
                     orderId: 'order-123',
                     status: 'pending',
                     stripePaymentIntentId: 'pi_test123'
                  }]));
                  return promise;
               })
            }))
         }));

         const refundData = {
            orderId: 'order-123',
            reason: 'customer_request' as const,
            requestedBy: 'user-123'
         };

         await expect(refundService.createRefund(refundData))
            .rejects.toThrow('Cannot refund payment that is not succeeded');
      });

      test('should throw error when refund amount exceeds payment amount', async () => {
         let selectCallCount = 0;
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                     const promise = Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]);
                     (promise as any).limit = mock(() => Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]));
                     return promise;
                  } else {
                     return Promise.resolve([]);
                  }
               })
            }))
         }));

         const refundData = {
            orderId: 'order-123',
            amount: 20.00, // Exceeds payment amount of 10.00
            reason: 'customer_request' as const,
            requestedBy: 'user-123'
         };

         await expect(refundService.createRefund(refundData))
            .rejects.toThrow('Refund amount cannot exceed payment amount');
      });

      test('should throw error when total refunds would exceed payment amount', async () => {
         let selectCallCount = 0;
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  selectCallCount++;
                  if (selectCallCount === 1) {
                     const promise = Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]);
                     (promise as any).limit = mock(() => Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]));
                     return promise;
                  } else {
                     // Mock existing refunds
                     return Promise.resolve([
                        { id: 'refund-1', amount: '5.00', status: 'succeeded' },
                        { id: 'refund-2', amount: '3.00', status: 'succeeded' }
                     ]);
                  }
               })
            }))
         }));

         const refundData = {
            orderId: 'order-123',
            amount: 5.00, // Would total 13.00, exceeding 10.00 payment
            reason: 'customer_request' as const,
            requestedBy: 'user-123'
         };

         await expect(refundService.createRefund(refundData))
            .rejects.toThrow('Total refund amount would exceed payment amount');
      });
   });

   describe('getRefundsByOrderId', () => {
      test('should get refunds by order ID successfully', async () => {
         const mockRefunds = [
            {
               id: 'refund-1',
               orderId: 'order-123',
               amount: '5.00',
               status: 'succeeded' as status,
               paymentId: 'payment-123',
               stripeRefundId: 're_test123',
               reason: 'customer_request' as reason,
               description: 'Customer requested refund',
               requestedBy: 'user-123',
               processedAt: new Date(),
               processedBy: 'admin-1',
               createdAt: new Date(),
               requestedAt: new Date()
            }
         ];

         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => Promise.resolve(mockRefunds))
            }))
         }));

         const result = await refundService.getRefundsByOrderId('order-123');

         expect(result).toEqual(mockRefunds);
      });

      test('should handle error when getting refunds', async () => {
         mockDb.select.mockImplementationOnce(() => {
            throw new Error('Database error');
         });

         await expect(refundService.getRefundsByOrderId('order-123'))
            .rejects.toThrow('Failed to get refunds: Error: Database error');
      });
   });

   describe('updateRefundStatus', () => {
      test('should update refund status successfully', async () => {
         const result = await refundService.updateRefundStatus('re_test123', 'succeeded');

         expect(result).toBeDefined();
         expect(result.id).toBe('refund-123');
         expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/refund-status'),
            expect.objectContaining({
               method: 'PUT',
               headers: { 'Content-Type': 'application/json' },
               body: expect.stringContaining('refund_completed')
            })
         );
      });

      test('should throw error when refund not found', async () => {
         mockDb.mockUpdateReturning.mockResolvedValueOnce([]);

         await expect(refundService.updateRefundStatus('re_nonexistent', 'succeeded'))
            .rejects.toThrow('Refund not found');
      });
   });

   describe('processAutomaticRefund', () => {
      test('should process automatic refund successfully', async () => {
         (global.fetch as any) = mock()
            .mockResolvedValueOnce({
               ok: true,
               json: () => Promise.resolve({
                  data: { user: { email: 'customer@example.com' } }
               })
            } as Response)
            .mockResolvedValue({
               ok: true,
               json: () => Promise.resolve({})
            } as Response);

         let selectCallCount = 0;
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  selectCallCount++;
                  if (selectCallCount === 1 || selectCallCount === 2) {
                     const promise = Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]);
                     (promise as any).limit = mock(() => Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]));
                     return promise;
                  } else {
                     return Promise.resolve([]);
                  }
               })
            }))
         }));

         const result = await refundService.processAutomaticRefund('order-123', 'restaurant_cancelled');

         expect(result).toBeDefined();
         expect(result?.customerEmail).toBe('customer@example.com');
         expect(result?.refund).toBeDefined();
         expect(result?.refundAmount).toBe(10.00);
      });

      test('should return null when payment not succeeded', async () => {
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  const promise = Promise.resolve([{
                     id: 'payment-123',
                     status: 'pending'
                  }]);
                  (promise as any).limit = mock(() => Promise.resolve([{
                     id: 'payment-123',
                     status: 'pending'
                  }]));
                  return promise;
               })
            }))
         }));

         const result = await refundService.processAutomaticRefund('order-123', 'restaurant_cancelled');

         expect(result).toBeNull();
      });

      test('should return null when no payment found', async () => {
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  const promise = Promise.resolve([]);
                  (promise as any).limit = mock(() => Promise.resolve([]));
                  return promise;
               })
            }))
         }));

         const result = await refundService.processAutomaticRefund('order-123', 'restaurant_cancelled');

         expect(result).toBeNull();
      });

      test('should handle customer API failure gracefully', async () => {
         (global.fetch as any) = mock()
            .mockResolvedValueOnce({
               ok: false,
               json: () => Promise.resolve({})
            } as Response)
            .mockResolvedValue({
               ok: true,
               json: () => Promise.resolve({})
            } as Response);

         let selectCallCount = 0;
         mockDb.select.mockImplementation(() => ({
            from: mock(() => ({
               where: mock(() => {
                  selectCallCount++;
                  if (selectCallCount === 1 || selectCallCount === 2) {
                     const promise = Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]);
                     (promise as any).limit = mock(() => Promise.resolve([{
                        id: 'payment-123',
                        orderId: 'order-123',
                        amount: '10.00',
                        status: 'succeeded',
                        stripePaymentIntentId: 'pi_test123',
                        userId: 'user-123'
                     }]));
                     return promise;
                  } else {
                     return Promise.resolve([]);
                  }
               })
            }))
         }));

         const result = await refundService.processAutomaticRefund('order-123', 'restaurant_cancelled');

         expect(result).toBeDefined();
         expect(result?.customerEmail).toBe('');
         expect(result?.refund).toBeDefined();
      });
   });

   describe('getRefundStats', () => {
      test('should get refund statistics successfully', async () => {
         const mockRefunds = [
            { id: 'refund-1', amount: '10.00', status: 'succeeded' },
            { id: 'refund-2', amount: '5.00', status: 'succeeded' },
            { id: 'refund-3', amount: '3.00', status: 'failed' }
         ];

         mockDb.select.mockImplementation(() => ({
            from: mock(() => Promise.resolve(mockRefunds))
         }));

         const result = await refundService.getRefundStats();

         expect(result).toEqual({
            totalRefunds: 3,
            successfulRefunds: 2,
            totalRefundAmount: 15.00,
            refundRate: 66.66666666666666
         });
      });

      test('should handle empty refunds list', async () => {
         mockDb.select.mockImplementation(() => ({
            from: mock(() => Promise.resolve([]))
         }));

         const result = await refundService.getRefundStats();

         expect(result).toEqual({
            totalRefunds: 0,
            successfulRefunds: 0,
            totalRefundAmount: 0,
            refundRate: 0
         });
      });
   });

   describe('mapToStripeReason', () => {
      test('should map reasons correctly', async () => {
         const testCases = [
            { input: 'customer_request', expected: 'requested_by_customer' },
            { input: 'restaurant_cancelled', expected: 'requested_by_customer' },
            { input: 'driver_unavailable', expected: 'requested_by_customer' },
            { input: 'food_quality', expected: 'requested_by_customer' },
            { input: 'other', expected: 'requested_by_customer' }
         ];

         for (const testCase of testCases) {
            let selectCallCount = 0;
            mockDb.select.mockImplementation(() => ({
               from: mock(() => ({
                  where: mock(() => {
                     selectCallCount++;
                     if (selectCallCount === 1) {
                        const promise = Promise.resolve([{
                           id: 'payment-123',
                           orderId: 'order-123',
                           amount: '10.00',
                           status: 'succeeded',
                           stripePaymentIntentId: 'pi_test123',
                           userId: 'user-123'
                        }]);
                        (promise as any).limit = mock(() => Promise.resolve([{
                           id: 'payment-123',
                           orderId: 'order-123',
                           amount: '10.00',
                           status: 'succeeded',
                           stripePaymentIntentId: 'pi_test123',
                           userId: 'user-123'
                        }]));
                        return promise;
                     } else {
                        return Promise.resolve([]);
                     }
                  })
               }))
            }));

            const refundData = {
               orderId: 'order-123',
               reason: testCase.input as any,
               requestedBy: 'user-123'
            };

            await refundService.createRefund(refundData);

            expect(mockStripeService.createRefund).toHaveBeenCalledWith(
               'pi_test123',
               10.00,
               testCase.expected,
               expect.any(Object)
            );

            mockStripeService.createRefund.mockClear();
         }
      });
   });
});