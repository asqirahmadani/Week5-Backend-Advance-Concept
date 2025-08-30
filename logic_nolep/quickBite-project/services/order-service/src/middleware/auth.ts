import type { Context } from 'elysia'
import type { JWTPayload } from '../type/auth';

export const authMiddleware = async (context: any) => {
   const { jwt, bearer, set } = context

   if (!bearer) {
      set.status = 401
      return { success: false, message: 'Authorization token required' }
   }

   try {
      const payload = await jwt.verify(bearer) as JWTPayload

      if (!payload) {
         set.status = 401
         return { success: false, message: 'Invalid token' }
      }

      // Add user info to context
      context.user = payload
      return;
   } catch (error) {
      set.status = 401
      return { success: false, message: 'Token verification failed' }
   }
}

export const roleMiddleware = (allowedRoles: string[]) => {
   return (context: any) => {
      const { user, set } = context

      if (!user) {
         set.status = 401
         return { success: false, message: 'Authentication required' }
      }

      if (!allowedRoles.includes(user.role)) {
         set.status = 403
         return { success: false, message: 'Insufficient permissions' }
      }

      return
   }
}