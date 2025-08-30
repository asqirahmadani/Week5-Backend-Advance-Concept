import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { WebhookController, type WebhookDependencies } from '../../src/routes/webhook.route'

// Helper function to create complete mock payment object
const createMockPayment = (overrides: any = {}) => ({
   id: 'payment_123',
   orderId: 'order_123',
   userId: 'user_123',
   stripePaymentIntentId: 'pi_test_123',
   amount: '20.00',
   currency: 'usd',
   paymentMethod: 'card' as const,
   status: 'succeeded' as const,
   fees: null,
   metadata: null,
   createdAt: new Date(),
   updatedAt: new Date(),
   ...overrides,
});

// Helper function to create mock Stripe events with all required properties
const createMockStripeEvent = (type: string, data: any) => ({
   id: 'evt_test_123',
   object: 'event',
   api_version: '2020-08-27',
   created: 1234567890,
   livemode: false,
   pending_webhooks: 1,
   request: {
      id: 'req_test_123',
      idempotency_key: null,
   },
   type,
   data,
});

describe('WebhookController', () => {
   let webhookController: WebhookController;
   let mockDependencies: WebhookDependencies;

   beforeEach(() => {
      // Create mock dependencies with proper typing
      mockDependencies = {
         stripeService: {
            verifyWebHookSignature: mock(),
         },
         refundService: {
            updateRefundStatus: mock(),
         },
         paymentService: {
            updatePaymentStatusBySessionId: mock(),
            updatePaymentStatus: mock(),
            getPaymentByIntentId: mock(),
         },
      } as any;

      webhookController = new WebhookController(mockDependencies);

      // Mock environment variable
      process.env.STRIPE_WEBHOOK_SECRET = 'test_webhook_secret';

      // Mock console methods to avoid noise in tests
      spyOn(console, 'log').mockImplementation(() => { });
      spyOn(console, 'error').mockImplementation(() => { });
   });

   describe('handleStripeWebhook', () => {
      const createMockRequest = (signature: string | null, body: string = '{}') => ({
         headers: {
            get: mock(() => signature),
         },
         text: mock(() => Promise.resolve(body)),
      });

      const mockSet = { status: 200 };

      it('should return error when stripe signature is missing', async () => {
         const request = createMockRequest(null);
         const result = await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(result).toEqual({
            success: false,
            error: 'Missing Stripe signature',
            timestamp: expect.any(String),
         });
      });

      it('should return error when webhook secret is not configured', async () => {
         delete process.env.STRIPE_WEBHOOK_SECRET;
         const request = createMockRequest('test_signature');
         const result = await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(result).toEqual({
            success: false,
            error: 'Webhook secret not configured',
            timestamp: expect.any(String),
         });
         expect(mockSet.status).toBe(500);
      });

      it('should handle checkout.session.completed event successfully', async () => {
         const mockEvent = createMockStripeEvent('checkout.session.completed', {
            object: {
               id: 'cs_test_123',
               payment_intent: 'pi_test_123',
               amount_total: 2000,
               currency: 'usd',
               metadata: {
                  orderId: 'order_123',
                  userId: 'user_123',
               },
            },
         });

         const mockPaymentResult = createMockPayment();

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.updatePaymentStatusBySessionId as any).mockImplementation(
            () => Promise.resolve(mockPaymentResult)
         );

         const request = createMockRequest('test_signature');
         const result = await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.stripeService.verifyWebHookSignature).toHaveBeenCalledWith(
            '{}',
            'test_signature',
            'test_webhook_secret'
         );
         expect(mockDependencies.paymentService.updatePaymentStatusBySessionId).toHaveBeenCalledWith(
            'cs_test_123',
            'succeeded',
            'pi_test_123'
         );
         expect(result).toEqual({
            success: true,
            data: { received: true },
            timestamp: expect.any(String),
         });
      });

      it('should handle checkout.session.expired event', async () => {
         const mockEvent = createMockStripeEvent('checkout.session.expired', {
            object: {
               id: 'cs_expired_123',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.updatePaymentStatusBySessionId as any).mockImplementation(
            () => Promise.resolve(createMockPayment({ status: 'cancelled' }))
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.paymentService.updatePaymentStatusBySessionId).toHaveBeenCalledWith(
            'cs_expired_123',
            'cancelled'
         );
      });

      it('should handle payment_intent.succeeded event when payment not already processed', async () => {
         const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
            object: {
               id: 'pi_test_123',
               metadata: {
                  orderId: 'order_123',
                  userId: 'user_123',
               },
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.getPaymentByIntentId as any).mockImplementation(
            () => Promise.resolve(null)
         );
         (mockDependencies.paymentService.updatePaymentStatus as any).mockImplementation(
            () => Promise.resolve(createMockPayment())
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.paymentService.getPaymentByIntentId).toHaveBeenCalledWith('pi_test_123');
         expect(mockDependencies.paymentService.updatePaymentStatus).toHaveBeenCalledWith('pi_test_123', 'succeeded');
      });

      it('should skip payment_intent.succeeded when already processed', async () => {
         const mockEvent = createMockStripeEvent('payment_intent.succeeded', {
            object: {
               id: 'pi_test_123',
               metadata: {},
            },
         });

         const existingPayment = createMockPayment({ status: 'succeeded' });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.getPaymentByIntentId as any).mockImplementation(
            () => Promise.resolve(existingPayment)
         );
         (mockDependencies.paymentService.updatePaymentStatus as any).mockImplementation(
            () => Promise.resolve(createMockPayment())
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.paymentService.updatePaymentStatus).not.toHaveBeenCalled();
      });

      it('should handle payment_intent.payment_failed event', async () => {
         const mockEvent = createMockStripeEvent('payment_intent.payment_failed', {
            object: {
               id: 'pi_failed_123',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.updatePaymentStatus as any).mockImplementation(
            () => Promise.resolve(createMockPayment({ status: 'failed' }))
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.paymentService.updatePaymentStatus).toHaveBeenCalledWith(
            'pi_failed_123',
            'failed'
         );
      });

      it('should handle payment_intent.canceled event', async () => {
         const mockEvent = createMockStripeEvent('payment_intent.canceled', {
            object: {
               id: 'pi_canceled_123',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.updatePaymentStatus as any).mockImplementation(
            () => Promise.resolve(createMockPayment({ status: 'cancelled' }))
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.paymentService.updatePaymentStatus).toHaveBeenCalledWith(
            'pi_canceled_123',
            'cancelled'
         );
      });

      it('should handle refund.created event with succeeded status', async () => {
         const mockEvent = createMockStripeEvent('refund.created', {
            object: {
               id: 're_test_123',
               status: 'succeeded',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.refundService.updateRefundStatus as any).mockImplementation(
            () => Promise.resolve({})
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.refundService.updateRefundStatus).toHaveBeenCalledWith(
            're_test_123',
            'succeeded'
         );
      });

      it('should handle refund.created event with failed status', async () => {
         const mockEvent = createMockStripeEvent('refund.created', {
            object: {
               id: 're_failed_123',
               status: 'failed',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.refundService.updateRefundStatus as any).mockImplementation(
            () => Promise.resolve({})
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.refundService.updateRefundStatus).toHaveBeenCalledWith(
            're_failed_123',
            'failed'
         );
      });

      it('should handle refund.updated event', async () => {
         const mockEvent = createMockStripeEvent('refund.updated', {
            object: {
               id: 're_updated_123',
               status: 'processing',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.refundService.updateRefundStatus as any).mockImplementation(
            () => Promise.resolve({})
         );

         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(mockDependencies.refundService.updateRefundStatus).toHaveBeenCalledWith(
            're_updated_123',
            'processing'
         );
      });

      it('should log ignored events without processing', async () => {
         const mockEvent = createMockStripeEvent('payment_intent.created', {
            object: {},
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );

         const consoleSpy = spyOn(console, 'log');
         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(consoleSpy).toHaveBeenCalledWith('ℹ️ Ignoring event: payment_intent.created (normal flow)');
      });

      it('should log unhandled event types', async () => {
         const mockEvent = createMockStripeEvent('unknown.event.type', {
            object: {},
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );

         const consoleSpy = spyOn(console, 'log');
         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(consoleSpy).toHaveBeenCalledWith('Unhandled event type: unknown.event.type');
      });

      it('should handle webhook processing errors gracefully', async () => {
         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.reject(new Error('Signature verification failed'))
         );

         const request = createMockRequest('invalid_signature');
         const result = await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(result).toEqual({
            success: false,
            error: 'Webhook processing failed',
            timestamp: expect.any(String),
         });
      });

      it('should handle transfer events with metadata', async () => {
         const mockTransferEvent = createMockStripeEvent('transfer.created', {
            object: {
               id: 'tr_test_123',
               metadata: {
                  earningId: 'earning_123',
                  settlementId: 'settlement_123',
               },
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockTransferEvent)
         );

         const consoleSpy = spyOn(console, 'log');
         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(consoleSpy).toHaveBeenCalledWith('Driver payout initiated: earning_123');
         expect(consoleSpy).toHaveBeenCalledWith('Restaurant settlement initiated: settlement_123');
      });

      it('should handle transfer.updated with reversed status', async () => {
         const mockTransferEvent = createMockStripeEvent('transfer.updated', {
            object: {
               id: 'tr_test_123',
               reversed: true,
               metadata: {
                  earningId: 'earning_123',
               },
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockTransferEvent)
         );

         const consoleSpy = spyOn(console, 'log');
         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(consoleSpy).toHaveBeenCalledWith('Driver payout failed/reversed: earning_123');
      });

      it('should handle charge.dispute.created event', async () => {
         const mockDisputeEvent = createMockStripeEvent('charge.dispute.created', {
            object: {
               charge: 'ch_test_123',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockDisputeEvent)
         );

         const consoleSpy = spyOn(console, 'log');
         const request = createMockRequest('test_signature');
         await webhookController.handleStripeWebhook(request as any, mockSet);

         expect(consoleSpy).toHaveBeenCalledWith('Chargeback created for charge: ch_test_123');
      });
   });

   describe('Error handling in individual handlers', () => {
      it('should handle errors in checkout session completion gracefully', async () => {
         const mockEvent = createMockStripeEvent('checkout.session.completed', {
            object: {
               id: 'cs_test_123',
               payment_intent: 'pi_test_123',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.paymentService.updatePaymentStatusBySessionId as any).mockImplementation(
            () => Promise.reject(new Error('Database error'))
         );

         const consoleSpy = spyOn(console, 'error');
         const request = {
            headers: { get: mock(() => 'test_signature') },
            text: mock(() => Promise.resolve('{}'))
         };

         await webhookController.handleStripeWebhook(request as any, { status: 200 });

         expect(consoleSpy).toHaveBeenCalledWith(
            'Error handling checkout session completion:',
            expect.any(Error)
         );
      });

      it('should handle errors in refund processing gracefully', async () => {
         const mockEvent = createMockStripeEvent('refund.created', {
            object: {
               id: 're_test_123',
               status: 'succeeded',
            },
         });

         (mockDependencies.stripeService.verifyWebHookSignature as any).mockImplementation(
            () => Promise.resolve(mockEvent)
         );
         (mockDependencies.refundService.updateRefundStatus as any).mockImplementation(
            () => Promise.reject(new Error('Refund service error'))
         );

         const consoleSpy = spyOn(console, 'error');
         const request = {
            headers: { get: mock(() => 'test_signature') },
            text: mock(() => Promise.resolve('{}'))
         };

         await webhookController.handleStripeWebhook(request as any, { status: 200 });

         expect(consoleSpy).toHaveBeenCalledWith(
            'Error handling refund creation:',
            expect.any(Error)
         );
      });
   });
});