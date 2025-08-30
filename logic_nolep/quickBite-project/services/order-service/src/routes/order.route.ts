import { Elysia, t } from 'elysia';
import { OrderService } from '../services/order.service';

const createOrderSchema = t.Object({
   restaurantId: t.String({ format: 'uuid' }),
   items: t.Array(t.Object({
      menuItemId: t.String({ format: 'uuid' }),
      quantity: t.Number({ minimum: 1 }),
   })),
   deliveryAddress: t.String({ minLength: 1 }),
   deliveryFee: t.Optional(t.String())
});

const updateStatusSchema = t.Object({
   status: t.Union([
      t.Literal('pending'),
      t.Literal('confirmed'),
      t.Literal('preparing'),
      t.Literal('ready'),
      t.Literal('picked_up'),
      t.Literal('delivered'),
      t.Literal('cancelled')
   ]),
   driverId: t.Optional(t.String()),
   estimatedDeliveryTime: t.Optional(t.Number({ minimum: 1, maximum: 480 })),
   actualDeliveryTime: t.Optional(t.String()),
   notes: t.Optional(t.String())
});

const cancelOrderSchema = t.Object({
   reason: t.Optional(t.String())
});

const paymentStatusSchema = t.Object({
   event: t.Union([
      t.Literal('pending'),
      t.Literal('paid'),
      t.Literal('refunded'),
      t.Literal('failed')
   ]),
   timestamp: t.String({ format: 'date-time' })
});

const refundStatusSchema = t.Object({
   event: t.Union([
      t.Literal('pending'),
      t.Literal('paid'),
      t.Literal('refunded'),
      t.Literal('failed')
   ]),
   amount: t.Optional(t.Number({ minimum: 0 })),
   timestamp: t.String({ format: 'date-time' })
});

// Protected routes that require authentication
const protectedOrder = new Elysia()
   // Dependency injection for OrderService
   .derive(({ db, orderService }: any) => ({
      orderService: orderService || new OrderService(db)
   }))

   // Authentication middleware
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

   // create order
   .post('/', async ({ body, user, orderService, set }) => {
      try {
         const order = await orderService.createOrder({
            ...body,
            customerId: user.sub
         });

         set.status = 200;
         return {
            success: true,
            message: 'Order created successfully',
            data: { order }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to create order'
         }
      }
   }, {
      body: createOrderSchema
   })

   // driver: accept order
   .post('/:orderId/accept', async ({ params, user, orderService, set }) => {
      try {
         const result = await orderService.assignDriverWithDetails(params.orderId, user.sub);

         return {
            success: true,
            message: 'Order accepted successfully',
            data: {
               order: result.order,
               customerEmail: result.customerEmail,
               customerName: result.customerName,
               restaurantEmail: result.restaurantEmail,
               restaurantName: result.restaurantName,
               driverName: result.driverName,
               estimatedArrival: result.estimatedArrival
            }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to accept order'
         }
      }
   })

   // get customer orders
   .get('/my-orders', async ({ query, user, orderService, set }) => {
      try {
         const page = parseInt(query.page as string) || 1;
         const limit = parseInt(query.limit as string) || 10;

         const orders = await orderService.getOrdersByCustomer(user.sub, page, limit);
         const total = await orderService.getCustomerOrdersCount(user.sub);

         return {
            success: true,
            data: {
               orders,
               pagination: {
                  page,
                  limit,
                  total,
                  totalPages: Math.ceil(total / limit)
               }
            }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to get orders'
         }
      }
   }, {
      query: t.Object({
         page: t.Optional(t.String()),
         limit: t.Optional(t.String())
      })
   })

   // driver: get available orders
   .get('/driver/available', async ({ orderService, set }) => {
      try {
         const orders = await orderService.getAvailableOrders();
         return {
            success: true,
            data: { orders }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to get available orders'
         }
      }
   })

// Public routes that don't require authentication
const publicOrder = new Elysia()
   // Dependency injection for OrderService
   .derive(({ db, orderService }: any) => ({
      orderService: orderService || new OrderService(db)
   }))

   // get order details
   .get('/:orderId', async ({ params, orderService, set }) => {
      try {
         const order = await orderService.getOrderById(params.orderId);

         if (!order) {
            set.status = 404;
            return {
               success: false,
               message: 'Order not found'
            }
         }

         return {
            success: true,
            data: { order }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to get order'
         }
      }
   })

   // restaurants: get orders (restaurant owner)
   .get('/restaurant/:restaurantId', async ({ params, query, orderService, set }) => {
      try {
         const page = parseInt(query.page as string) || 1;
         const limit = parseInt(query.limit as string) || 10;
         const status = query.status as any;

         const orders = await orderService.getOrdersByRestaurant(
            params.restaurantId,
            status,
            page,
            limit
         );
         const total = await orderService.getRestaurantOrdersCount(params.restaurantId);

         return {
            success: true,
            data: {
               orders,
               pagination: {
                  page,
                  limit,
                  total,
                  totalPages: Math.ceil(total / limit)
               }
            }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to get orders'
         }
      }
   }, {
      query: t.Object({
         page: t.Optional(t.String()),
         limit: t.Optional(t.String()),
         status: t.Optional(t.String())
      })
   })

   // update order status
   .patch('/:orderId/status', async ({ params, body, orderService, set }) => {
      try {
         const updateData: any = {
            status: body.status,
            driverId: body.driverId,
            notes: body.notes
         }

         if (body.estimatedDeliveryTime) {
            const now = new Date();
            updateData.estimatedDeliveryTime = new Date(
               now.getTime() + (body.estimatedDeliveryTime * 60 * 1000)
            )
         }

         if (body.status === 'delivered') {
            updateData.actualDeliveryTime = new Date();
         }

         const order = await orderService.updateOrderStatus(params.orderId, updateData);
         return {
            success: true,
            message: 'Order status updated',
            data: { order }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update order status'
         }
      }
   }, {
      body: updateStatusSchema
   })

   // update payment status
   .put('/:orderId/payment-status', async ({ params, body, orderService, set }) => {
      try {
         const order = await orderService.updatePaymentStatus(
            params.orderId,
            body.event,
            body.timestamp
         );

         return {
            success: true,
            message: 'Payment status updated successfully',
            data: { order }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update payment status'
         }
      }
   }, {
      body: paymentStatusSchema
   })

   // update refund status
   .put('/:orderId/refund-status', async ({ params, body, orderService, set }) => {
      try {
         const order = await orderService.updateRefundStatus(
            params.orderId,
            body.event,
            body.amount,
            body.timestamp
         );

         return {
            success: true,
            message: 'Refund status updated successfully',
            data: { order }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update refund status'
         }
      }
   }, {
      body: refundStatusSchema
   })

   // cancel order
   .patch('/:orderId/cancel', async ({ params, body, orderService, set }) => {
      try {
         const order = await orderService.cancelOrder(params.orderId, body.reason);

         return {
            success: true,
            message: 'Order cancelled successfully',
            data: { order }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to cancel order'
         }
      }
   }, {
      body: cancelOrderSchema
   })

   // get order statistics
   .get('/stats/:restaurantId', async ({ params, orderService, set }) => {
      try {
         const stats = await orderService.getOrderStats(params.restaurantId);

         return {
            success: true,
            data: { stats }
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to get order stats'
         }
      }
   })

export const orderRoutes = new Elysia({ prefix: '/api/orders' })
   .use(publicOrder)
   .use(protectedOrder);