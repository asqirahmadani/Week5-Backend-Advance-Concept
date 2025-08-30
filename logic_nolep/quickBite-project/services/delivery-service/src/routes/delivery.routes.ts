import { Elysia, t } from 'elysia';
import { DeliveryService } from '../services/delivery.service';

const protectedRoutes = new Elysia()
   .derive(({ db }: any) => ({
      deliveryService: new DeliveryService(db)
   }))

   .derive(({ headers, set }: any) => {
      console.log(headers);
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

   // get driver's current deliveries
   .get('/my-deliveries', async ({ user, deliveryService, set }) => {
      if (user.role !== 'driver') {
         set.status = 403;
         return { success: false, error: 'Only driver can view their deliveries' };
      }

      const deliveries = await deliveryService.getDriverDeliveries(user.sub);
      return {
         success: true,
         data: deliveries
      }
   })

   // assign driver to order (internal service call)
   .post('/assign-driver', async ({ body, user, set, deliveryService }) => {
      try {
         const assignment = await deliveryService.assignDriver(body, user.sub);
         return {
            success: true,
            data: assignment
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Assignment failed'
         }
      }
   }, {
      body: t.Object({
         orderId: t.String(),
         customerId: t.String(),
         restaurantId: t.String(),
         deliveryAddress: t.String(),
         customerPhone: t.Optional(t.String()),
         restaurantAddress: t.Optional(t.String())
      })
   })

   // driver accepts delivery
   .post('/:deliveryId/accept', async ({ params, user, set, deliveryService }) => {
      try {
         if (user.role !== 'driver') {
            set.status = 403;
            return { success: false, error: 'Only drivers can accept deliveries' };
         }
         console.log(user);
         const delivery = await deliveryService.acceptDelivery(params.deliveryId, user.sub);
         return {
            success: true,
            data: delivery
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to accept delivery'
         }
      }
   })

   // update delivery status
   .patch('/:deliveryId/status', async ({ params, body, user, set, deliveryService }) => {
      try {
         if (user.role !== 'driver') {
            set.status = 403;
            return { success: false, error: 'Only driver can update delivery status' }
         }

         const delivery = await deliveryService.updateDeliveryStatus(
            params.deliveryId,
            user.sub,
            body.status,
            body.location
         );

         return {
            success: true,
            data: delivery
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update status'
         };
      }
   }, {
      body: t.Object({
         status: t.Union([
            t.Literal('picked_up'),
            t.Literal('delivered'),
            t.Literal('cancelled')
         ]),
         location: t.Optional(t.Object({
            latitude: t.Number(),
            longitude: t.Number()
         }))
      })
   })

const publicRoutes = new Elysia()
   .derive(({ db }: any) => ({
      deliveryService: new DeliveryService(db)
   }))

   // get delivery by order id
   .get('/order/:orderId', async ({ params, deliveryService }) => {
      const delivery = await deliveryService.getDeliveryByOrderId(params.orderId);
      return {
         success: true,
         data: delivery
      }
   })

   // get delivery tracking
   .get('/:deliveryId/tracking', async ({ params, deliveryService }) => {
      const tracking = await deliveryService.getDeliveryTracking(params.deliveryId);
      return {
         success: true,
         data: tracking
      }
   })

   // assign driver to order (internal service call)
   .post('/assign', async ({ body, set, deliveryService }) => {
      try {
         const assignment = await deliveryService.assignDriver(body);
         return {
            success: true,
            data: assignment
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Assignment failed'
         }
      }
   }, {
      body: t.Object({
         orderId: t.String(),
         customerId: t.String(),
         restaurantId: t.String(),
         deliveryAddress: t.String(),
         customerPhone: t.Optional(t.String()),
         restaurantAddress: t.Optional(t.String())
      })
   })

   // driver cancel delivery
   .patch('/:deliveryId/cancel', async ({ params, set, deliveryService }) => {
      try {
         const delivery = await deliveryService.cancelDelivery(params.deliveryId);
         return {
            success: true,
            data: delivery
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to accept delivery'
         }
      }
   });

export const deliveryRoutes = new Elysia({ prefix: '/api/deliveries' })
   .use(protectedRoutes)
   .use(publicRoutes);