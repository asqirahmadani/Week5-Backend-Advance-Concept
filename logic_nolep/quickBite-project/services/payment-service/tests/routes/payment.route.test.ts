import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Elysia, t } from 'elysia';

// Mock utils first
mock.module('../../src/utils/response', () => ({
   successResponse: (data: any, message?: string) => ({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
   }),
   errorResponse: (error: string, data?: any) => ({
      success: false,
      error,
      data,
      timestamp: new Date().toISOString(),
   })
}));

// Mock types with proper TypeBox schemas
mock.module('../../src/types', () => ({
   createPaymentSchema: t.Object({
      orderId: t.String({ format: 'uuid' }),
      amount: t.Number({ minimum: 0 }),
      currency: t.Optional(t.String()),
      paymentMethod: t.String(),
      metadata: t.Optional(t.Record(t.String(), t.Any()))
   }),
   CreateCheckoutPaymentSchema: t.Object({
      orderId: t.String({ format: 'uuid' }),
      amount: t.Number({ minimum: 0 }),
      currency: t.Optional(t.String()),
      paymentMethod: t.String(),
      successUrl: t.Optional(t.String()),
      cancelUrl: t.Optional(t.String()),
      metadata: t.Optional(t.Record(t.String(), t.Any()))
   }),
   confirmPaymentSchema: t.Object({
      paymentIntentId: t.String()
   }),
   createDriverEarningSchema: t.Object({
      driverId: t.String({ format: 'uuid' }),
      orderId: t.String({ format: 'uuid' }),
      baseEarning: t.Number({ minimum: 0 }),
      tipAmount: t.Optional(t.Number({ minimum: 0 })),
      bonusAmount: t.Optional(t.Number({ minimum: 0 }))
   }),
   createSettlementSchema: t.Object({
      restaurantId: t.String({ format: 'uuid' }),
      orderId: t.String({ format: 'uuid' }),
      grossAmount: t.Number({ minimum: 0 }),
      commissionRate: t.Number({ minimum: 0, maximum: 1 })
   }),
   processPayoutSchema: t.Object({
      stripeAccountId: t.String()
   })
}));

// Import route factory after mock setup
import { createPaymentsRoute } from '../../src/routes/payment.route';

describe('Payment Routes with DI', () => {
   let app: Elysia;
   let mockPaymentService: any;

   beforeEach(() => {
      // Create mock service with all required methods
      mockPaymentService = {
         createPayment: mock(),
         createPaymentWithCheckout: mock(),
         createPaymentLink: mock(),
         updatePaymentStatus: mock(),
         updatePaymentStatusBySessionId: mock(),
         getPaymentByOrderId: mock(),
         createDriverEarning: mock(),
         createRestaurantSettlement: mock(),
         processDriverPayout: mock(),
         processRestaurantSettlement: mock()
      };

      // Reset all mocks
      Object.values(mockPaymentService).forEach((mockFn: any) => mockFn.mockReset());

      // Create app with mock service
      app = new Elysia().use(createPaymentsRoute(mockPaymentService));
   });

   describe('Protected Routes', () => {
      const mockHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'customer',
         'x-user-email': 'test@example.com'
      };

      describe('POST /api/payments/create', () => {
         test('should successfully create payment intent', async () => {
            const mockPayment = {
               id: 'payment-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: 100.00,
               status: 'pending',
               clientSecret: 'pi_test_client_secret',
               paymentIntentId: 'pi_test_123'
            };

            mockPaymentService.createPayment.mockResolvedValue(mockPayment);

            const response = await app.handle(
               new Request('http://localhost/api/payments/create', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify({
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     amount: 100,
                     currency: 'USD',
                     paymentMethod: 'card'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPayment);
            expect(data.message).toBe('Payment intent created successfully');
            expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
               expect.objectContaining({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  amount: 100,
                  paymentMethod: 'card'
               }),
               'user-123'
            );
         });

         test('should return 401 when user authentication is missing', async () => {
            const response = await app.handle(
               new Request('http://localhost/api/payments/create', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     amount: 100,
                     paymentMethod: 'card'
                  })
               })
            );

            expect(response.status).toBe(401);
         });

         test('should handle payment creation error', async () => {
            mockPaymentService.createPayment.mockRejectedValue(new Error('Payment creation failed'));

            const response = await app.handle(
               new Request('http://localhost/api/payments/create', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify({
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     amount: 100,
                     currency: 'USD',
                     paymentMethod: 'card'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Failed to create payment: Payment creation failed');
         });
      });

      describe('POST /api/payments/create-checkout', () => {
         test('should successfully create checkout payment', async () => {
            const mockPayment = {
               id: 'payment-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: 100.00,
               status: 'pending',
               clientSecret: '',
               paymentIntentId: 'pi_test_123',
               paymentUrl: 'https://checkout.stripe.com/pay/cs_test_123',
               sessionId: 'cs_test_123'
            };

            mockPaymentService.createPaymentWithCheckout.mockResolvedValue(mockPayment);

            const response = await app.handle(
               new Request('http://localhost/api/payments/create-checkout', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify({
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     amount: 100,
                     currency: 'USD',
                     paymentMethod: 'card',
                     successUrl: 'http://localhost:3004/success',
                     cancelUrl: 'http://localhost:3004/cancel'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPayment);
            expect(data.message).toBe('Checkout payment created successfully');
         });
      });

      describe('POST /api/payments/create-payment-link', () => {
         test('should successfully create payment link', async () => {
            const mockPaymentLink = {
               paymentLinkUrl: 'https://buy.stripe.com/test_123',
               paymentLinkId: 'plink_123'
            };

            mockPaymentService.createPaymentLink.mockResolvedValue(mockPaymentLink);

            const response = await app.handle(
               new Request('http://localhost/api/payments/create-payment-link', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     ...mockHeaders
                  },
                  body: JSON.stringify({
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     amount: 100,
                     currency: 'USD',
                     paymentMethod: 'card'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPaymentLink);
            expect(data.message).toBe('Payment link created successfully');
         });
      });
   });

   describe('Public Routes', () => {
      describe('POST /api/payments/confirm', () => {
         test('harus berhasil confirm payment', async () => {
            const mockPayment = {
               id: 'payment-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: 100.00,
               status: 'succeeded'
            };

            mockPaymentService.updatePaymentStatus.mockResolvedValue(mockPayment);

            const response = await app.handle(
               new Request('http://localhost/api/payments/confirm', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     paymentIntentId: 'pi_test_123'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPayment);
            expect(data.message).toBe('Payment confirmed successfully');
         });

         test('harus handle payment confirmation error', async () => {
            mockPaymentService.updatePaymentStatus.mockRejectedValue(new Error('Payment not found'));

            const response = await app.handle(
               new Request('http://localhost/api/payments/confirm', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     paymentIntentId: 'pi_invalid_123'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Failed to confirm payment: Payment not found');
         });
      });

      describe('POST /api/payments/:paymentIntentId/cancel', () => {
         test('harus berhasil cancel payment by payment intent ID', async () => {
            const mockPayment = {
               id: 'payment-123',
               status: 'cancelled'
            };

            mockPaymentService.updatePaymentStatus.mockResolvedValue(mockPayment);

            const response = await app.handle(
               new Request('http://localhost/api/payments/pi_test_123/cancel', {
                  method: 'POST'
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPayment);
            expect(data.message).toBe('Payment cancelled successfully');
         });
      });

      describe('PATCH /api/payments/:sessionId/cancel', () => {
         test('harus berhasil cancel payment by session ID', async () => {
            const mockPayment = {
               id: 'payment-123',
               status: 'cancelled'
            };

            mockPaymentService.updatePaymentStatusBySessionId.mockResolvedValue(mockPayment);

            const response = await app.handle(
               new Request('http://localhost/api/payments/cs_test_123/cancel', {
                  method: 'PATCH'
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPayment);
            expect(data.message).toBe('Payment cancelled successfully');
         });
      });

      describe('GET /api/payments/order/:orderId', () => {
         test('harus berhasil get payment by order ID', async () => {
            const mockPayment = {
               id: 'payment-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: 100.00,
               status: 'succeeded'
            };

            mockPaymentService.getPaymentByOrderId.mockResolvedValue(mockPayment);

            const response = await app.handle(
               new Request('http://localhost/api/payments/order/550e8400-e29b-41d4-a716-446655440000')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockPayment);
         });

         test('harus return error ketika payment tidak ditemukan', async () => {
            mockPaymentService.getPaymentByOrderId.mockResolvedValue(null);

            const response = await app.handle(
               new Request('http://localhost/api/payments/order/550e8400-e29b-41d4-a716-446655440000')
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Payment not found');
         });
      });

      describe('POST /api/payments/driver-earning', () => {
         test('harus berhasil membuat driver earning', async () => {
            const mockEarning = {
               id: 'earning-123',
               driverId: '550e8400-e29b-41d4-a716-446655440001',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               totalEarning: 25.50,
               status: 'pending'
            };

            mockPaymentService.createDriverEarning.mockResolvedValue(mockEarning);

            const response = await app.handle(
               new Request('http://localhost/api/payments/driver-earning', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     driverId: '550e8400-e29b-41d4-a716-446655440001',
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     baseEarning: 20.00,
                     tipAmount: 5.50
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockEarning);
            expect(data.message).toBe('Driver earning created successfully');
         });
      });

      describe('POST /api/payments/settlements', () => {
         test('harus berhasil membuat restaurant settlement', async () => {
            const mockSettlement = {
               id: 'settlement-123',
               restaurantId: '550e8400-e29b-41d4-a716-446655440002',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               netAmount: 85.00,
               status: 'pending'
            };

            mockPaymentService.createRestaurantSettlement.mockResolvedValue(mockSettlement);

            const response = await app.handle(
               new Request('http://localhost/api/payments/settlements', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     restaurantId: '550e8400-e29b-41d4-a716-446655440002',
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     grossAmount: 100.00,
                     commissionRate: 0.15
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockSettlement);
            expect(data.message).toBe('Restaurant settlement created successfully');
         });
      });

      describe('POST /api/payments/driver-earning/:earningId/payout', () => {
         test('harus berhasil process driver payout', async () => {
            const mockTransfer = {
               id: 'tr_test_123',
               amount: 2550,
               destination: 'acct_test_123'
            };

            mockPaymentService.processDriverPayout.mockResolvedValue(mockTransfer);

            const response = await app.handle(
               new Request('http://localhost/api/payments/driver-earning/550e8400-e29b-41d4-a716-446655440000/payout', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     stripeAccountId: 'acct_test_123'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockTransfer);
            expect(data.message).toBe('Driver payout processed successfully');
         });
      });

      describe('POST /api/payments/settlements/:settlementId/payout', () => {
         test('harus berhasil process restaurant settlement', async () => {
            const mockTransfer = {
               id: 'tr_test_456',
               amount: 8500,
               destination: 'acct_restaurant_123'
            };

            mockPaymentService.processRestaurantSettlement.mockResolvedValue(mockTransfer);

            const response = await app.handle(
               new Request('http://localhost/api/payments/settlements/550e8400-e29b-41d4-a716-446655440000/payout', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     stripeAccountId: 'acct_restaurant_123'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual(mockTransfer);
            expect(data.message).toBe('Restaurant settlement processed successfully');
         });

         test('harus handle processing error', async () => {
            mockPaymentService.processRestaurantSettlement.mockRejectedValue(new Error('Settlement not found'));

            const response = await app.handle(
               new Request('http://localhost/api/payments/settlements/550e8400-e29b-41d4-a716-446655440000/payout', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     stripeAccountId: 'acct_restaurant_123'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.error).toBe('Failed to process restaurant settlement: Settlement not found');
         });
      });
   });

   describe('Edge Cases and Error Handling', () => {
      test('harus handle malformed JSON in request body', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/payments/confirm', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: 'invalid json {'
            })
         );

         expect(response.status).toBe(400);
      });

      test('harus handle service unavailable errors', async () => {
         mockPaymentService.createPayment.mockRejectedValue(new Error('Service temporarily unavailable'));

         const response = await app.handle(
            new Request('http://localhost/api/payments/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': 'user-123',
                  'x-user-role': 'customer',
                  'x-user-email': 'test@example.com'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  amount: 100,
                  currency: 'USD',
                  paymentMethod: 'card'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Failed to create payment: Service temporarily unavailable');
      });
   });

   describe('Authentication and Authorization', () => {
      test('harus pass user context ke payment service untuk protected routes', async () => {
         const mockPayment = {
            id: 'payment-123',
            orderId: '550e8400-e29b-41d4-a716-446655440001',
            amount: 200.00,
            status: 'pending'
         };

         mockPaymentService.createPayment.mockResolvedValue(mockPayment);

         await app.handle(
            new Request('http://localhost/api/payments/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': 'user-456',
                  'x-user-role': 'premium',
                  'x-user-email': 'premium@example.com'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440001',
                  amount: 200,
                  currency: 'USD',
                  paymentMethod: 'wallet'
               })
            })
         );

         expect(mockPaymentService.createPayment).toHaveBeenCalledWith(
            expect.objectContaining({
               orderId: '550e8400-e29b-41d4-a716-446655440001',
               amount: 200,
               paymentMethod: 'wallet'
            }),
            'user-456'
         );
      });

      test('harus handle different user roles', async () => {
         const mockPayment = {
            id: 'payment-123',
            orderId: '550e8400-e29b-41d4-a716-446655440002',
            amount: 50.00,
            status: 'pending'
         };

         mockPaymentService.createPaymentWithCheckout.mockResolvedValue(mockPayment);

         await app.handle(
            new Request('http://localhost/api/payments/create-checkout', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': 'driver-789',
                  'x-user-role': 'driver',
                  'x-user-email': 'driver@example.com'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440002',
                  amount: 50,
                  currency: 'USD',
                  paymentMethod: 'card'
               })
            })
         );

         expect(mockPaymentService.createPaymentWithCheckout).toHaveBeenCalledWith(
            expect.objectContaining({
               orderId: '550e8400-e29b-41d4-a716-446655440002',
               amount: 50,
               paymentMethod: 'card'
            }),
            'driver-789',
            'driver@example.com'
         );
      });
   });
});