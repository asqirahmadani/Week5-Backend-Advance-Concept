import { Elysia, t } from 'elysia';
import { NotificationService } from '../services/notification.service';

const protectedNotification = new Elysia()
   .derive(({ db }: any) => ({
      notificationService: new NotificationService(db)
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

   .get('/history', async ({ query, user, set, notificationService }: any) => {
      try {
         const limit = query.limit ? parseInt(query.limit) : 50;
         const history = await notificationService.getNotificationHistory(user.sub, limit);
         return {
            success: true,
            data: history
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to queue notification'
         }
      }
   }, {
      query: t.Object({
         limit: t.Optional(t.String())
      })
   })

   .post('/send', async ({ user, body, set, notificationService }) => {
      try {
         const notification = await notificationService.queueNotification(user.sub, body);
         return {
            success: true,
            data: notification
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to queue notification'
         }
      }
   }, {
      body: t.Object({
         templateKey: t.String(),
         notificationType: t.Union([t.Literal('email'), t.Literal('sms'), t.Literal('push')]),
         recipient: t.String(),
         variables: t.Optional(t.Record(t.String(), t.Any())),
         scheduledAt: t.Optional(t.Date())
      })
   })

const publicNotification = new Elysia()
   .derive(({ db }: any) => ({
      notificationService: new NotificationService(db)
   }))

   .get('/stats', async ({ query, set, notificationService }) => {
      try {
         const days = query.days ? parseInt(query.days) : 30;
         const stats = await notificationService.getNotificationStats(days);
         return {
            success: true,
            data: stats
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to queue notification'
         }
      }
   }, {
      query: t.Object({
         days: t.Optional(t.String())
      })
   })

   .post('/process', async ({ set, notificationService }) => {
      try {
         const results = await notificationService.processPendingNotifications();
         return {
            success: true,
            data: results
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to queue notification'
         }
      }
   })

   .post('/retry', async ({ set, notificationService }) => {
      try {
         const results = await notificationService.retryFailedNotifications();
         return {
            success: true,
            data: results
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to queue notification'
         }
      }
   });

export const notificationRoutes = new Elysia({ prefix: '/api/notifications' })
   .use(protectedNotification)
   .use(publicNotification);