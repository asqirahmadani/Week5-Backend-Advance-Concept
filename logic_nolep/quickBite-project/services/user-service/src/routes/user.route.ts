import jwt from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';
import { UserService } from '../services/user.service';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

export const userRoutes = new Elysia({ prefix: '/api' })
   .derive(({ db }: any) => ({
      userService: new UserService(db)
   }))

   // get all users (admin only)
   .get('/', async ({ query, userService, set }) => {
      try {
         const page = parseInt(query.page || '1');
         const limit = parseInt(query.limit || '10');

         const [usersList, totalCount] = await Promise.all([
            userService.getAllUsers(page, limit),
            userService.getUsersCount()
         ]);

         return {
            success: true,
            data: {
               users: usersList,
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
            message: error.message || 'Failed to get users'
         }
      }
   }, {
      beforeHandle: [authMiddleware, roleMiddleware(['admin'])],
      query: t.Object({
         page: t.Optional(t.String()),
         limit: t.Optional(t.String())
      })
   })

   .put('/profile', async ({ body, user, userService, set }: any) => {
      try {
         const updatedUser = await userService.updateUser(user.sub, body);

         return {
            success: true,
            message: 'Profile updated successfully',
            data: { user: updatedUser }
         }
      } catch (error: any) {
         set.status = 400;
         return {
            success: false,
            message: error.message || 'Update failed'
         }
      }
   }, {
      beforeHandle: authMiddleware,
      body: t.Object({
         fullName: t.Optional(t.String()),
         email: t.Optional(t.String()),
         password: t.Optional(t.String()),
         phone: t.Optional(t.String()),
         address: t.Optional(t.String()),
         city: t.Optional(t.String())
      })
   })

   .get('/users/:userId', async ({ params, userService, set }) => {
      try {
         const user = await userService.getUserById(params.userId);
         if (!user) {
            set.status = 404;
            return {
               success: false,
               message: 'User not found'
            }
         }

         return {
            success: true,
            data: { user }
         }
      } catch (error: any) {
         set.status = 500;
         return {
            success: false,
            message: error.message || 'Failed to get user'
         }
      }
   })

   .get('/drivers/available', async ({ userService, set }) => {
      try {
         const drivers = await userService.getAvailableDriver();
         set.status = 200;
         return {
            success: true,
            data: { drivers }
         }
      } catch (error: any) {
         set.status = 500;
         return {
            success: false,
            message: error.message || 'Failed to get available drivers'
         }
      }
   })

   // delete users (only admin)
   .delete('/users/:userId', async ({ params, userService, set }) => {
      try {
         const deletedUser = await userService.deleteUser(params.userId);
         set.status = 200;
         return {
            success: true,
            message: 'User deleted successfully',
            deletedUser: {
               name: deletedUser.name,
               role: deletedUser.role
            }
         }
      } catch (error: any) {
         set.status = 400;
         return {
            success: false,
            message: error.message || 'Failed to delete user'
         }
      }
   }, {
      beforeHandle: [authMiddleware, roleMiddleware(['admin'])],
      params: t.Object({
         userId: t.String()
      })
   })