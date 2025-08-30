import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { config } from '@/config/env';
import type { UserRole } from '@/types';

export const jwtMiddleware = jwt({
   name: 'jwt',
   secret: config.jwt.secret,
   exp: config.jwt.expiresIn
});

export const authMiddleware = new Elysia({ name: 'auth' })
   .use(jwtMiddleware)
   .derive(async ({ headers, jwt, set }: any) => {
      const authorization = headers.authorization;
      console.log(headers);

      if (!authorization || !authorization.startsWith('Bearer ')) {
         set.status = 401;
         throw new Error('Missing or invalid authorization header');
      }

      const token = authorization.substring(7);

      try {
         const payload = await jwt.verify(token);

         if (!payload || !payload.userId) {
            set.status = 401;
            throw new Error('Invalid token payload');
         }

         console.log(payload);
         return {
            user: payload,
            userId: payload.userId,
            userRole: payload.role,
            userEmail: payload.email
         };
      } catch (error) {
         set.status = 401;
         throw new Error('Invalid or expired token');
      }
   });



export const roleGuard = (allowedRoles: UserRole[]) => {
   return new Elysia({ name: `role-guard-${allowedRoles.join('-')}` })
      .derive(({ userRole, set }: any) => {
         if (!userRole || !allowedRoles.includes(userRole)) {
            set.status = 403;
            throw new Error('Insufficient permissions');
         }
         return {};
      });
};

export const roleMiddleware = (allowedRoles: string[]) => {
   return (context: any) => {
      const { user, set } = context

      if (!user || !allowedRoles.includes(user.role)) {
         set.status = 403
         return { success: false, message: 'Insufficient permissions' }
      }

      return;
   }
}