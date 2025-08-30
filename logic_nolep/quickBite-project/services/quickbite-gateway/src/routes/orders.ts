import { Elysia, t } from 'elysia';
import { ServiceClient } from '@/utils/service-client';
import { roleMiddleware, jwtMiddleware } from '@/middleware/auth';
import { OrderFlowOrchestrator } from '@/orchestrators/order.flow';

const orderOrchestrator = new OrderFlowOrchestrator();

export const orderRoutes = new Elysia({ prefix: '/api/orders' })
   .use(jwtMiddleware)

   // authorization here!! (if import from another folder not works??)
   .derive(async ({ headers, jwt, set }: any) => {
      const authorization = headers.authorization;

      if (!authorization || !authorization.startsWith('Bearer ')) {
         set.status = 401;
         throw new Error('Missing or invalid authorization header');
      }

      const token = authorization.substring(7);

      try {
         const payload = await jwt.verify(token);

         if (!payload || !payload.sub) {
            set.status = 401;
            throw new Error('Invalid token payload');
         }

         const result = {
            user: payload,
            userId: payload.sub,
            userRole: payload.role,
            userEmail: payload.email
         };

         return result;
      } catch (error) {
         set.status = 401;
         throw new Error('Invalid or expired token');
      }
   })

   // Orchestrated Order Creation
   .post('/', async ({ body, userId, userRole, userEmail, set }: any) => {
      const result = await orderOrchestrator.createOrder(
         userId,
         userEmail,
         userRole,
         body
      );

      if (!result.success) {
         set.status = 400;
         return {
            success: false,
            error: result.error,
            transactionId: result.transactionId
         };
      }

      set.status = 201;
      return {
         success: true,
         message: 'Order created successfully. Payment link sent to your email.',
         data: result.data,
         transactionId: result.transactionId
      };
   }, {
      body: t.Object({
         restaurantId: t.String(),
         items: t.Array(t.Object({
            menuItemId: t.String(),
            quantity: t.Number({ minimum: 1 })
         })),
         deliveryAddress: t.String(),
         specialInstruction: t.Optional(t.String())
      }),
      detail: {
         tags: ['Orders - Orchestrated'],
         summary: 'Create Order (Multi-Service Orchestration)',
         description: `
        **Orchestrated Process Flow:**
        1. Create order with PENDING_PAYMENT status in order-service
        2. Generate payment intent and link via payment-service  
        3. Send payment notification email via notification-service
        
        **Automatic Compensation:** If any step fails after order creation, 
        the system will automatically cancel the order and rollback changes.
        
        **Response:** Returns order details with payment link and transaction ID for tracking.
      `
      }
   })

   // Driver Accept Order (Orchestrated)
   .post('/:orderId/accept', async ({ params, userId, userRole, userEmail, set }: any) => {
      const result = await orderOrchestrator.acceptOrderByDriver(
         userId,
         userEmail,
         userRole,
         params.orderId
      );

      if (!result.success) {
         set.status = 400;
         return {
            success: false,
            error: result.error,
            transactionId: result.transactionId
         };
      }

      return {
         success: true,
         message: 'Order accepted successfully. Customer and restaurant have been notified.',
         data: result.data,
         transactionId: result.transactionId
      };
   }, {
      beforeHandle: [roleMiddleware(['driver'])],
      params: t.Object({
         orderId: t.String()
      }),
      detail: {
         tags: ['Orders - Orchestrated'],
         summary: 'Driver Accept Order (Multi-Service Orchestration)',
         description: `
        **Orchestrated Process Flow:**
        1. Update order status to CONFIRMED with driver assignment
        2. Create delivery assignment in delivery-service
        3. Send customer notification with driver details
        4. Send restaurant notification to start preparation
        
        **Automatic Compensation:** If any step fails, order will be reset to PENDING status.
      `
      }
   })

   // Cancel Order (Orchestrated)
   .patch('/:orderId/cancel', async ({ params, body, userId, userRole, userEmail, set }: any) => {
      const result = await orderOrchestrator.cancelOrder(
         userId,
         userEmail,
         userRole,
         params.orderId,
         body.reason || 'Customer requested cancellation'
      );

      if (!result.success) {
         set.status = 400;
         return {
            success: false,
            error: result.error,
            transactionId: result.transactionId
         };
      }

      return {
         success: true,
         message: 'Order cancelled successfully. Refund will be processed if applicable.',
         data: result.data,
         transactionId: result.transactionId
      };
   }, {
      params: t.Object({
         orderId: t.String()
      }),
      body: t.Object({
         reason: t.Optional(t.Union([
            t.Literal('customer_request'),
            t.Literal('restaurant_cancelled'),
            t.Literal('driver_unavailable'),
            t.Literal('food_quality'),
            t.Literal('other')
         ]))
      }),
      detail: {
         tags: ['Orders - Orchestrated'],
         summary: 'Cancel Order (Multi-Service Orchestration)',
         description: `
        **Orchestrated Process Flow:**
        1. Update order status to CANCELLED
        2. Process automatic refund if payment was made
        3. Send cancellation notification to customer
        
        **Compensation:** This is a terminal operation with built-in error handling.
      `
      }
   })

   // Non-Orchestrated Endpoints (Direct Pass-through)
   .get('/my-orders', async ({ userId, userRole, userEmail, set }) => {
      const result = await ServiceClient.call('order', '/api/orders/my-orders', {
         method: 'GET'
      }, { userId, userRole, userEmail });

      if (!result.success) {
         set.status = 400;
         return result;
      }

      return result;
   }, {
      detail: {
         tags: ['Orders - Direct'],
         summary: 'Get My Orders',
         description: 'Direct pass-through to order-service for customer orders'
      }
   })

   .get('/:orderId', async ({ params, set }) => {
      const result = await ServiceClient.call('order', `/api/orders/${params.orderId}`, {
         method: 'GET'
      });

      if (!result.success) {
         set.status = 404;
         return result;
      }

      return result;
   }, {
      params: t.Object({
         orderId: t.String()
      }),
      detail: {
         tags: ['Orders - Direct'],
         summary: 'Get Order Details',
         description: 'Direct pass-through to order-service for order details'
      }
   })

   .get('/restaurant/:restaurantId', async ({ params, userId, userRole, userEmail, set }) => {
      const result = await ServiceClient.call('order', `/api/orders/restaurant/${params.restaurantId}`, {
         method: 'GET'
      }, { userId, userRole, userEmail });

      if (!result.success) {
         set.status = 400;
         return result;
      }

      return result;
   }, {
      beforeHandle: [roleMiddleware(['restaurant_owner'])],
      params: t.Object({
         restaurantId: t.String()
      }),
      detail: {
         tags: ['Orders - Direct'],
         summary: 'Get Restaurant Orders (Owner)',
         description: 'Direct pass-through to order-service for restaurant orders'
      }
   });