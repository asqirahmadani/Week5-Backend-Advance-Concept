import { Elysia, t } from 'elysia';
import { PaymentService } from '../services/payment.service';
import {
   createPaymentSchema,
   CreateCheckoutPaymentSchema,
   confirmPaymentSchema,
   createDriverEarningSchema,
   createSettlementSchema,
   processPayoutSchema
} from '../types';
import { successResponse, errorResponse } from '../utils/response';

// Factory function untuk membuat route dengan dependency injection
export const createPaymentsRoute = (paymentService?: PaymentService) => {
   const service = paymentService || new PaymentService();

   const protectedPayments = new Elysia()
      .derive(({ headers, set }: any) => {
         const userId = headers['x-user-id'];
         const userRole = headers['x-user-role'];
         const userEmail = headers['x-user-email'];

         if (!userId) {
            set.status = 401;
            throw new Error('Missing user authentication from gateway');
         }

         return {
            user: {
               sub: userId,
               role: userRole,
               email: userEmail
            },
            userId,
            userRole,
            userEmail
         };
      })

      // create payment intent
      .post('/create', async ({ body, user }) => {
         try {
            const payment = await service.createPayment(body, user.sub);
            return successResponse(payment, 'Payment intent created successfully');
         } catch (error) {
            return errorResponse(`Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         body: createPaymentSchema,
         detail: {
            summary: 'Create Payment Intent',
            tags: ['Payments']
         }
      })

      // create checkout payment
      .post('/create-checkout', async ({ body, user }) => {
         try {
            const payment = await service.createPaymentWithCheckout(
               body,
               user.sub,
               user.email
            );

            return successResponse(payment, 'Checkout payment created successfully');
         } catch (error) {
            return errorResponse(`Failed to create checkout payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         body: CreateCheckoutPaymentSchema,
         detail: {
            summary: 'Create Checkout Payment',
            description: 'Creates a payment with Stripe Checkout that returns a payment URL',
            tags: ['Payments']
         }
      })

      // create payment link
      .post('/create-payment-link', async ({ body, user }) => {
         try {
            const paymentLink = await service.createPaymentLink(body, user.sub);
            return successResponse(paymentLink, 'Payment link created successfully');
         } catch (error) {
            return errorResponse(`Failed to create payment link: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         body: createPaymentSchema,
         detail: {
            summary: 'Create Payment Link',
            description: 'Creates a reusable Stripe Payment Link',
            tags: ['Payments']
         }
      })

   const publicPayment = new Elysia()
      // confirm payment
      .post('/confirm', async ({ body }) => {
         try {
            const payment = await service.updatePaymentStatus(
               body.paymentIntentId,
               'succeeded'
            );
            return successResponse(payment, 'Payment confirmed successfully');
         } catch (error) {
            return errorResponse(`Failed to confirm payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         body: confirmPaymentSchema,
         detail: {
            summary: 'Confirm Payment',
            tags: ['Payments'],
         }
      })

      // cancel payment by paymentIntentId
      .post('/:paymentIntentId/cancel', async ({ params }) => {
         try {
            const cancelPayment = await service.updatePaymentStatus(params.paymentIntentId, 'cancelled');
            return successResponse(cancelPayment, 'Payment cancelled successfully');
         } catch (error) {
            return errorResponse(`Failed to cancel payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      })

      // cancel payment by sessionId
      .patch('/:sessionId/cancel', async ({ params }) => {
         try {
            const cancelPayment = await service.updatePaymentStatusBySessionId(params.sessionId, 'cancelled');
            return successResponse(cancelPayment, 'Payment cancelled successfully');
         } catch (error) {
            return errorResponse(`Failed to cancel payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      })

      // get payment by order ID
      .get('/order/:orderId', async ({ params: { orderId } }) => {
         try {
            const payment = await service.getPaymentByOrderId(orderId);
            if (!payment) {
               return errorResponse('Payment not found');
            }

            return successResponse(payment);
         } catch (error) {
            return errorResponse(`Failed to get payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         params: t.Object({
            orderId: t.String({ format: 'uuid' })
         }),
         detail: {
            summary: 'Get Payment by Order ID',
            tags: ['Payments'],
         }
      })

      // create driver earning
      .post('/driver-earning', async ({ body }) => {
         try {
            const earning = await service.createDriverEarning(body);
            return successResponse(earning, 'Driver earning created successfully');
         } catch (error) {
            return errorResponse(`Failed to create driver earning: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         body: createDriverEarningSchema,
         detail: {
            summary: 'Create Driver Earning',
            tags: ['Payments'],
         }
      })

      // create restaurant settlement
      .post('/settlements', async ({ body }) => {
         try {
            const settlement = await service.createRestaurantSettlement(body);
            return successResponse(settlement, 'Restaurant settlement created successfully');
         } catch (error) {
            return errorResponse(`Failed to create settlement: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         body: createSettlementSchema,
         detail: {
            summary: 'Create Restaurant Settlement',
            tags: ['Payments'],
         }
      })

      // process driver payout
      .post('/driver-earning/:earningId/payout', async ({ params: { earningId }, body }) => {
         try {
            const transfer = await service.processDriverPayout(earningId, body.stripeAccountId);
            return successResponse(transfer, 'Driver payout processed successfully');
         } catch (error) {
            return errorResponse(`Failed to process payout: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         params: t.Object({
            earningId: t.String({ format: 'uuid' })
         }),
         body: processPayoutSchema,
         detail: {
            summary: 'Process Driver Payout',
            tags: ['Payments'],
         }
      })

      // process restaurant settlement
      .post('/settlements/:settlementId/payout', async ({ params: { settlementId }, body }) => {
         try {
            const transfer = await service.processRestaurantSettlement(
               settlementId,
               body.stripeAccountId
            );
            return successResponse(transfer, 'Restaurant settlement processed successfully');
         } catch (error) {
            return errorResponse(`Failed to process restaurant settlement: ${error instanceof Error ? error.message : 'Unknown error'}`);
         }
      }, {
         params: t.Object({
            settlementId: t.String({ format: 'uuid' })
         }),
         body: processPayoutSchema,
         detail: {
            summary: 'Process Restaurant Settlement',
            tags: ['Payments'],
         }
      })

   return new Elysia({ prefix: '/api/payments' })
      .use(publicPayment)
      .use(protectedPayments);
};

// Export default route tanpa dependency injection for production use
export const payments = createPaymentsRoute();