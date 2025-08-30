import { Elysia, t } from 'elysia';
import { RefundService } from '../services/refund.service';
import {
   createRefundSchema,
   refundStatsQuerySchema
} from '../types';
import { successResponse, errorResponse } from '../utils/response';

export const createRefundsRoute = (refundService?: RefundService) => {
   const service = refundService || new RefundService();

   const refundRoute = new Elysia()
      .post('/create', async ({ body }) => {
         try {
            const refund = await service.createRefund(body);
            return successResponse(refund, 'Refund initiated successfully');
         } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to create refund');
         }
      }, {
         body: createRefundSchema,
         detail: {
            summary: 'Create Refund',
            tags: ['Refunds'],
         }
      })

      // get refunds by order ID
      .get('/order/:orderId', async ({ params: { orderId } }) => {
         try {
            const orderRefunds = await service.getRefundsByOrderId(orderId);
            return successResponse(orderRefunds);
         } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to get refunds');
         }
      }, {
         params: t.Object({
            orderId: t.String({ format: 'uuid' }),
         }),
         detail: {
            summary: 'Get Refunds by Order ID',
            tags: ['Refunds'],
         }
      })

      // process automatic refund (internal endpoint)
      .post('/auto-refund', async ({ body }) => {
         try {
            const { orderId, reason } = body;

            const refund = await service.processAutomaticRefund(orderId, reason || 'other');

            console.log('Refund result: ', refund);
            if (!refund) {
               return successResponse(null, 'No refund needed for this order');
            }

            return successResponse({
               refund: refund.refund,
               customerEmail: refund.customerEmail,
               refundAmount: refund.refundAmount
            }, 'Automatic refund processed successfully');
         } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to process automatic refund');
         }
      }, {
         body: t.Object({
            orderId: t.String({ format: 'uuid' }),
            reason: t.Optional(t.Union([
               t.Literal('customer_request'),
               t.Literal('restaurant_cancelled'),
               t.Literal('driver_unavailable'),
               t.Literal('food_quality'),
               t.Literal('other')
            ]))
         }),
         detail: {
            summary: 'Process Automatic Refund',
            tags: ['Refunds'],
         }
      })

      // get refund statistics
      .get('/stats', async ({ query }) => {
         try {
            const { restaurantId, dateFrom, dateTo } = query;

            const stats = await service.getRefundStats(
               restaurantId,
               dateFrom ? new Date(dateFrom) : undefined,
               dateTo ? new Date(dateTo) : undefined
            );

            return successResponse(stats);
         } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Failed to get refund statistics');
         }
      }, {
         query: t.Optional(refundStatsQuerySchema),
         detail: {
            summary: 'Get Refund Statistics',
            tags: ['Refunds'],
         }
      })

   return new Elysia({ prefix: '/api/refunds' })
      .use(refundRoute)
}

export const refunds = createRefundsRoute();