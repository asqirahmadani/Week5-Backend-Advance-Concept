import { Elysia, t } from 'elysia';
import { RestaurantService } from '../services/restaurant.service';

const publicRoutes = new Elysia()
   .derive(({ db, restaurantService }: any) => ({
      restaurantService: restaurantService || new RestaurantService(db)
   }))

   // get all restaurant (public)
   .get('/', async ({ query, restaurantService, set }) => {
      try {
         const page = parseInt(query.page || '1');
         const limit = parseInt(query.limit || '10');
         const city = query.city;
         const cuisine = query.cuisine;
         const isActive = query.isActive !== 'false';

         const [restaurants, totalCount] = await Promise.all([
            restaurantService.getAllRestaurants(page, limit, { city, cuisine, isActive }),
            restaurantService.getRestaurantCount({ city, cuisine, isActive })
         ]);

         set.status = 200;
         return {
            success: true,
            data: {
               restaurants,
               pagination: {
                  page,
                  limit,
                  total: totalCount,
                  totalPages: Math.ceil(totalCount / limit)
               }
            }
         }
      } catch (error: any) {
         set.status = 500;
         return {
            success: false,
            message: error.message || 'Failed to get restaurant'
         }
      }
   }, {
      query: t.Object({
         page: t.Optional(t.String()),
         limit: t.Optional(t.String()),
         city: t.Optional(t.String()),
         cuisine: t.Optional(t.String()),
         isActive: t.Optional(t.String())
      })
   })

   // get restaurant by ID (public)
   .get('/:id', async ({ params, restaurantService, set }) => {
      try {
         const restaurant = await restaurantService.getRestaurantById(params.id);
         set.status = 200;
         return {
            success: true,
            data: { restaurant }
         }
      } catch (error: any) {
         set.status = error.message === 'Restaurant not found' ? 404 : 500;
         return {
            success: false,
            message: error.message || 'Failed to get restaurant'
         }
      }
   })

   // Update Restaurant Rating
   .patch('/:restaurantId/rating', async ({ params, body, restaurantService, set }) => {
      try {
         const result = await restaurantService.updateRestaurantRating(
            params.restaurantId,
            body.newRating,
            body.reviewId
         );

         set.status = 200;
         return {
            success: true,
            message: 'Restaurant rating updated successfully',
            data: result
         };
      } catch (error: any) {
         set.status = error.message === 'Restaurant not found' ? 404 : 500;
         return {
            success: false,
            message: error.message || 'Failed to update restaurant rating'
         };
      }
   }, {
      body: t.Object({
         newRating: t.Number({ minimum: 1, maximum: 5 }),
         reviewId: t.String()
      })
   })

   // get restaurant menu
   .get('/:id/menu', async ({ params, restaurantService, set }) => {
      try {
         const menu = await restaurantService.getRestaurantMenu(params.id);
         set.status = 200;
         return {
            success: true,
            message: 'Get restaurant menu successfully',
            data: menu
         }
      } catch (error: any) {
         set.status = error.message === 'Restaurant not found' ? 404 : 500;
         return {
            success: false,
            message: error.message || 'Failed to get restaurant menu'
         }
      }
   })

const protectedRoutes = new Elysia()
   .derive(({ db, restaurantService }: any) => ({
      restaurantService: restaurantService || new RestaurantService(db)
   }))

   .derive(({ headers, set }) => {
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

   // create restaurant
   .post('/', async ({ body, user, restaurantService, set }) => {
      try {
         const restaurantData = {
            ownerId: user.sub,
            ...body
         }

         const restaurant = await restaurantService.createRestaurant(restaurantData);
         set.status = 201;
         return {
            success: true,
            message: 'Restaurant created successfully',
            data: { restaurant }
         }
      } catch (error: any) {
         set.status = 400;
         return {
            success: false,
            message: error.message || 'Failed to create restaurant'
         }
      }
   }, {
      body: t.Object({
         name: t.String(),
         description: t.Optional(t.String()),
         cuisineType: t.String(),
         address: t.String(),
         city: t.String(),
         phone: t.String(),
         email: t.String({ format: 'email' }),
         deliveryFee: t.Number(),
         minimumOrder: t.Number(),
         estimatedPrepTime: t.Number()
      })
   })

   // update restaurant
   .put('/:id', async ({ params, body, user, restaurantService, set }) => {
      try {
         const restaurant = await restaurantService.updateRestaurant(params.id, body, user);
         set.status = 200;
         return {
            success: true,
            message: 'Restaurant updated successfully',
            data: { restaurant }
         }
      } catch (error: any) {
         set.status = error.message.includes('not found') ? 404 : 403;
         return {
            success: false,
            message: error.message || 'Failed to update restaurant'
         }
      }
   }, {
      body: t.Object({
         name: t.Optional(t.String()),
         description: t.Optional(t.String()),
         cuisineType: t.Optional(t.String()),
         address: t.Optional(t.String()),
         city: t.Optional(t.String()),
         latitude: t.Optional(t.Number()),
         longitude: t.Optional(t.Number()),
         phone: t.Optional(t.String()),
         email: t.Optional(t.String()),
         rating: t.Optional(t.Number()),
         totalReviews: t.Optional(t.Number()),
         deliveryFee: t.Optional(t.Number()),
         minimumOrder: t.Optional(t.Number()),
         estimatedPrepTime: t.Optional(t.Number()),
         isActive: t.Optional(t.Boolean()),
         isOpen: t.Optional(t.Boolean())
      })
   })

   // delete restaurant
   .delete('/:id', async ({ params, restaurantService, set }) => {
      try {
         const deletedRestaurant = await restaurantService.deleteRestaurant(params.id);
         set.status = 200;
         return {
            success: true,
            message: 'Restaurant deleted successfully',
            data: { deletedRestaurant }
         }
      } catch (error: any) {
         set.status = error.message === 'Restaurant not found' ? 404 : 500;
         return {
            success: false,
            message: error.message || 'Failed to delete restaurant'
         }
      }
   })

   // get my restaurants (restaurant owner)
   .get('/owner/my-restaurants', async ({ user, restaurantService, set }) => {
      try {
         const restaurants = await restaurantService.getOwnerRestaurants(user.sub);
         set.status = 200;
         return {
            success: true,
            data: { restaurants }
         }
      } catch (error: any) {
         set.status = 500;
         return {
            success: false,
            message: error.message || 'Failed to get your restaurants'
         }
      }
   })


export const restaurantRoutes = new Elysia({ prefix: '/api/restaurant' })
   .use(publicRoutes)
   .use(protectedRoutes);