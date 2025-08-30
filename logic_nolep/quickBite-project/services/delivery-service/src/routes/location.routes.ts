import { Elysia, t } from 'elysia';
import { DeliveryService } from '../services/delivery.service';

export const locationRoutes = new Elysia({ prefix: '/api/locations' })
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

   .post('/update', async ({ body, user, set, deliveryService }) => {
      try {
         if (user.role !== 'driver') {
            set.status = 403;
            return { success: false, error: 'Only drivers can update location' };
         }

         const location = await deliveryService.updateDriverLocation(
            body.userId,
            body.latitude,
            body.longitude,
            body.isOnline
         );

         return {
            success: true,
            data: location
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update location'
         };
      }
   }, {
      body: t.Object({
         userId: t.String(),
         latitude: t.Number(),
         longitude: t.Number(),
         isOnline: t.Optional(t.Boolean())
      })
   })