import { Elysia, t } from 'elysia';
import { ReviewService } from '../services/review.service';

const protectedRoutes = new Elysia()
   .derive(({ db }: any) => ({
      reviewService: new ReviewService(db)
   }))

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

   // get customer reviews
   .get('/customer/my-reviews', async ({ user, reviewService }) => {
      const reviews = await reviewService.getCustomerReviews(user.sub);
      return {
         success: true,
         data: reviews
      };
   })

   // create review
   .post('/', async ({ body, user, set, reviewService }) => {
      try {
         const review = await reviewService.createReview({
            ...body,
            customerId: user.sub
         });

         return {
            success: true,
            data: review
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create review'
         };
      }
   }, {
      body: t.Object({
         orderId: t.String(),
         restaurantId: t.String(),
         restaurantRating: t.Integer({ minimum: 1, maximum: 5 }),
         driverRating: t.Optional(t.Integer({ minimum: 1, maximum: 5 })),
         foodQuality: t.Integer({ minimum: 1, maximum: 5 }),
         deliveryTime: t.Integer({ minimum: 1, maximum: 5 }),
         restaurantComment: t.Optional(t.String()),
         driverComment: t.Optional(t.String())
      })
   })

   // add review response (admin or restaurant owner)
   .post('/:reviewId/response', async ({ params, body, user, set, reviewService }) => {
      try {
         const responderType = user.role === 'admin' ? 'admin' : 'restaurant';
         const response = await reviewService.addReviewResponse({
            reviewId: params.reviewId,
            responderId: user.sub,
            responderType,
            response: body.response
         });

         return {
            success: true,
            data: response
         };
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add response'
         };
      }
   }, {
      body: t.Object({
         response: t.String({ minLength: 1, maxLength: 1000 })
      })
   })

   // mark review as helpful
   .post('/:reviewId/helpful', async ({ params, body, user, set, reviewService }) => {
      try {
         const helpful = await reviewService.markReviewHelpful(
            params.reviewId,
            user.sub,
            body.isHelpful
         );

         return {
            success: true,
            data: helpful
         };
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to mark review'
         };
      }
   }, {
      body: t.Object({
         isHelpful: t.Boolean()
      })
   })

   // report review
   .post('/:reviewId/report', async ({ params, body, user, set, reviewService }) => {
      try {
         const report = await reviewService.reportReview({
            reviewId: params.reviewId,
            reporterId: user.sub,
            reason: body.reason,
            description: body.description
         });

         return {
            success: true,
            data: report
         };
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to report review'
         };
      }
   }, {
      body: t.Object({
         reason: t.Union([
            t.Literal('spam'),
            t.Literal('inappropriate'),
            t.Literal('fake'),
            t.Literal('offensive'),
            t.Literal('other')
         ]),
         description: t.Optional(t.String())
      })
   })

   // Delete review
   .delete('/:reviewId', async ({ params, set, reviewService }) => {
      try {
         const result = await reviewService.deleteReview(params.reviewId);

         return {
            success: true,
            message: 'Review deleted successfully',
            data: result
         };
      } catch (error) {
         set.status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete review'
         };
      }
   });

const publicRoutes = new Elysia()
   .derive(({ db }: any) => ({
      reviewService: new ReviewService(db)
   }))

   // get restaurant reviews
   .get('/restaurant/:restaurantId', async ({ params, query, reviewService }) => {
      const page = query.page ? parseInt(query.page) : 1;
      const limit = query.limit ? parseInt(query.limit) : 10;

      const reviews = await reviewService.getRestaurantReviews(
         params.restaurantId,
         page,
         limit
      );

      return {
         success: true,
         data: reviews,
         pagination: { page, limit }
      }
   }, {
      query: t.Object({
         page: t.Optional(t.String()),
         limit: t.Optional(t.String())
      })
   })

   // get restaurant statistics
   .get('/restaurant/:restaurantId/stats', async ({ params, reviewService }) => {
      const stats = await reviewService.getRestaurantStats(params.restaurantId);
      return {
         success: true,
         data: stats
      };
   })

   // get driver reviews
   .get('/driver/:driverId', async ({ params, reviewService }) => {
      const reviews = await reviewService.getDriverReviews(params.driverId);
      return {
         success: true,
         data: reviews
      };
   })

   // get driver statistics
   .get('/driver/:driverId/stats', async ({ params, reviewService }) => {
      const stats = await reviewService.getDriverStats(params.driverId);
      return {
         success: true,
         data: stats
      };
   })

export const reviewRoutes = new Elysia({ prefix: '/api/reviews' })
   .use(protectedRoutes)
   .use(publicRoutes);