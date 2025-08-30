import { Elysia, t } from 'elysia';
import { ReviewService } from '../services/review.service';

export const adminRoutes = new Elysia({ prefix: '/api/admin/reviews' })
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

      if (userRole !== 'admin') {
         set.status = 403;
         throw new Error('Access forbidden: Admins only');
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

   // get reported reviews (admin only)
   .get('/reports', async ({ query, set, reviewService }) => {
      const reports = await reviewService.getReportedReviews(query.status);
      return {
         success: true,
         data: reports
      };
   }, {
      query: t.Object({
         status: t.Optional(t.Union([
            t.Literal('pending'),
            t.Literal('reviewed'),
            t.Literal('resolved'),
            t.Literal('rejected')
         ]))
      })
   })

   // resolve review report (admin only)
   .patch('/reports/:reportId', async ({ params, body, user, set, reviewService }) => {
      try {
         const resolved = await reviewService.resolverReviewReport(
            params.reportId,
            user.sub,
            body.action
         );

         return {
            success: true,
            data: resolved
         };
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to resolve report'
         };
      }
   }, {
      body: t.Object({
         action: t.Union([t.Literal('resolve'), t.Literal('reject')])
      })
   })