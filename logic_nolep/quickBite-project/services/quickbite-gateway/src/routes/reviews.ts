import { Elysia, t } from 'elysia';
import { ServiceClient } from '@/utils/service-client';
import { roleMiddleware, jwtMiddleware } from '@/middleware/auth';
import { ReviewFlowOrchestrator } from '@/orchestrators/review.flow';

const reviewOrchestrator = new ReviewFlowOrchestrator();

export const reviewRoutes = new Elysia({ prefix: '/api/reviews' })
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

   // Orchestrated Review Creation
   .post('/', async ({ body, userId, userRole, userEmail, set }) => {
      const result = await reviewOrchestrator.createReview(userId, userEmail, userRole, body);

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
         message: 'Review submitted successfully. Restaurant ratings updated.',
         data: result.data,
         transactionId: result.transactionId
      };
   }, {
      beforeHandle: [roleMiddleware(['customer'])],
      body: t.Object({
         orderId: t.String(),
         restaurantId: t.String(),
         restaurantRating: t.Number({ minimum: 1, maximum: 5 }),
         foodQuality: t.Number({ minimum: 1, maximum: 5 }),
         deliveryTime: t.Number({ minimum: 1, maximum: 5 }),
         restaurantComment: t.String({ minLength: 1 })
      }),
      detail: {
         tags: ['Reviews - Orchestrated'],
         summary: 'Create Review (Multi-Service Orchestration)',
         description: `
        **Orchestrated Process Flow:**
        1. Create review record in review-service
        2. Update restaurant rating and statistics in restaurant-service
        
        **Automatic Compensation:** If rating updates fail, the review will be deleted automatically.
        
        **Response:** Returns review details with updated statistics and transaction ID.
      `
      }
   })

   // Non-Orchestrated Endpoints (Direct Pass-through)
   .get('/restaurant/:restaurantId', async ({ params, set }) => {
      const result = await ServiceClient.call('review', `/api/reviews/restaurant/${params.restaurantId}`, {
         method: 'GET'
      });

      if (!result.success) {
         set.status = 404;
         return result;
      }

      return result;
   }, {
      params: t.Object({
         restaurantId: t.String()
      }),
      detail: {
         tags: ['Reviews - Direct'],
         summary: 'Get Restaurant Reviews',
         description: 'Direct pass-through to review-service for restaurant reviews'
      }
   })

   .get('/restaurant/:restaurantId/stats', async ({ params, set }) => {
      const result = await ServiceClient.call('review', `/api/reviews/restaurant/${params.restaurantId}/stats`, {
         method: 'GET'
      });

      if (!result.success) {
         set.status = 404;
         return result;
      }

      return result;
   }, {
      params: t.Object({
         restaurantId: t.String()
      }),
      detail: {
         tags: ['Reviews - Direct'],
         summary: 'Get Restaurant Review Statistics',
         description: 'Direct pass-through to review-service for restaurant statistics'
      }
   })

   .get('/customer/my-reviews', async ({ userId, userRole, userEmail, set }) => {
      const result = await ServiceClient.call('review', '/api/reviews/customer/my-reviews', {
         method: 'GET'
      }, { userId, userRole, userEmail });

      if (!result.success) {
         set.status = 400;
         return result;
      }

      return result;
   }, {
      beforeHandle: [roleMiddleware(['customer'])],
      detail: {
         tags: ['Reviews - Direct'],
         summary: 'Get My Reviews',
         description: 'Direct pass-through to review-service for customer reviews'
      }
   });