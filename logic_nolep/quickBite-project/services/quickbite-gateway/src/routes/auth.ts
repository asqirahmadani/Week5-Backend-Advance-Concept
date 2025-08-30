import { Elysia, t } from 'elysia';
import { jwtMiddleware } from '@/middleware/auth';
import { ServiceClient } from '@/utils/service-client';

export const authRoutes = new Elysia({ prefix: '/api/auth' })
   .use(jwtMiddleware)

   // direct pass-through endpoints
   .post('/register', async ({ body, set }) => {
      const result = await ServiceClient.call('user', '/api/auth/register', {
         method: 'POST',
         body: JSON.stringify(body)
      });

      if (!result.success) {
         set.status = 400;
         return result;
      }

      return result;
   }, {
      body: t.Object({
         email: t.String({ format: 'email' }),
         password: t.String({ minLength: 6 }),
         fullName: t.String({ minLength: 2 }),
         phone: t.String({ minLength: 10 }),
         role: t.Optional(t.Union([
            t.Literal('customer'),
            t.Literal('driver'),
            t.Literal('restaurant_owner')
         ]))
      }),
      detail: {
         tags: ['Authentication'],
         summary: 'Register new user',
         description: 'Create a new user account'
      }
   })

   .post('/login', async ({ body, set }) => {
      const result = await ServiceClient.call('user', '/api/auth/login', {
         method: 'POST',
         body: JSON.stringify(body)
      });

      if (!result.success) {
         set.status = 401;
         return result
      }

      return result;
   }, {
      body: t.Object({
         email: t.String({ format: 'email' }),
         password: t.String({ minLength: 1 })
      }),
      detail: {
         tags: ['Authentication'],
         summary: 'User login',
         description: 'Authenticate user and return JWT token'
      }
   })

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

   .get('/profile', async ({ userId, userRole, userEmail, set }: any) => {
      const result = await ServiceClient.call('user', '/api/auth/profile', {
         method: 'GET'
      }, { userId, userRole, userEmail });

      if (!result.success) {
         set.status = 400;
         return result;
      }

      return result;
   }, {
      detail: {
         tags: ['Authentication'],
         summary: 'Get user profile',
         description: 'Retrieve authenticated user profile information'
      }
   })

   .delete('/logout', async ({ userId, userRole, userEmail, set }: any) => {
      const result = await ServiceClient.call('user', '/api/auth/logout', {
         method: 'DELETE'
      }, { userId, userRole, userEmail });

      if (!result.success) {
         set.status = 400;
         return result;
      }

      return result;
   }, {
      detail: {
         tags: ['Authentication'],
         summary: 'User logout',
         description: 'Invalidate user session and logout'
      }
   });