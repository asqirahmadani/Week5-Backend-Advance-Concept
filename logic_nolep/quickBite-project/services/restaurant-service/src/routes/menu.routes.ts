import { Elysia, t } from 'elysia';
import { RestaurantService } from '../services/restaurant.service';

const publicRoutes = new Elysia()
   .derive(({ db, restaurantService }: any) => ({
      restaurantService: restaurantService || new RestaurantService(db)
   }))

   .get('/categories/:restaurantId', async ({ params, restaurantService, set }) => {
      try {
         const categories = await restaurantService.getMenuCategory(params.restaurantId);
         set.status = 200;
         return {
            success: true,
            message: 'Get Categories successfully',
            data: categories
         }
      } catch (error: any) {
         set.status = 400;
         return {
            success: false,
            message: error.message || 'Failed to get categories'
         };
      }
   })

   // get menu item by id
   .get('/items/:itemsId', async ({ params, set, restaurantService }) => {
      try {
         const item = await restaurantService.getMenuItemById(params.itemsId);
         set.status = 200;
         return {
            success: true,
            message: 'Get menu item successfully',
            data: { item }
         }
      } catch (error: any) {
         set.status = error.message.includes('not found') ? 404 : 403;
         return {
            success: false,
            message: error.message || 'Failed to get menu item'
         };
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

   // Add menu category (restaurant owner)
   .post('/categories', async ({ body, user, restaurantService, set }) => {
      try {
         const category = await restaurantService.createMenuCategory(body, user);
         set.status = 201;
         return {
            success: true,
            message: 'Category created successfully',
            data: { category }
         };
      } catch (error: any) {
         set.status = error.message.includes('permission') ? 403 : 400;
         return {
            success: false,
            message: error.message || 'Failed to create category'
         };
      }
   }, {
      body: t.Object({
         restaurantId: t.String(),
         name: t.String(),
         description: t.Optional(t.String()),
         sortOrder: t.Optional(t.Number())
      })
   })

   // Add menu item (restaurant owner)
   .post('/items', async ({ body, user, restaurantService, set }) => {
      try {
         const item = await restaurantService.createMenuItem(body, user);
         set.status = 201;
         return {
            success: true,
            message: 'Menu item created successfully',
            data: { item }
         };
      } catch (error: any) {
         set.status = error.message.includes('permission') ? 403 : 400;
         return {
            success: false,
            message: error.message || 'Failed to create menu item'
         };
      }
   }, {
      body: t.Object({
         restaurantId: t.String(),
         categoryId: t.String(),
         name: t.String(),
         description: t.Optional(t.String()),
         price: t.Number(),
         preparationTime: t.Optional(t.Number())
      })
   })

   // Update menu item (restaurant owner)
   .put('/items/:id', async ({ params, body, user, restaurantService, set }) => {
      try {
         const item = await restaurantService.updateMenuItem(params.id, body, user);
         set.status = 200;
         return {
            success: true,
            message: 'Menu item updated successfully',
            data: { item }
         };
      } catch (error: any) {
         set.status = error.message.includes('not found') ? 404 : 403;
         return {
            success: false,
            message: error.message || 'Failed to update menu item'
         };
      }
   }, {
      body: t.Object({
         restaurantId: t.String(),
         name: t.Optional(t.String()),
         description: t.Optional(t.String()),
         price: t.Optional(t.Number()),
         isAvailable: t.Optional(t.Boolean()),
         preparationTime: t.Optional(t.Number())
      })
   })

   // Delete menu item (restaurant owner)
   .delete('/items/:id', async ({ params, user, restaurantService, set }) => {
      try {
         const deletedItem = await restaurantService.deleteMenuItem(params.id, user);
         set.status = 200;
         return {
            success: true,
            message: 'Menu item deleted successfully',
            data: { deletedItem }
         };
      } catch (error: any) {
         set.status = error.message.includes('not found') ? 404 : 403;
         return {
            success: false,
            message: error.message || 'Failed to delete menu item'
         };
      }
   });

export const menuRoutes = new Elysia({ prefix: '/api/menus' })
   .use(publicRoutes)
   .use(protectedRoutes);