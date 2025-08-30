import { Elysia, t } from 'elysia';
import { NotificationService } from '../services/notification.service';

export const templateRoutes = new Elysia({ prefix: '/api/templates' })
   .derive(({ db }: any) => ({
      notificationService: new NotificationService(db)
   }))

   .derive(({ headers, set }) => {
      const userId = headers['x-user-id'];
      const userRole = headers['x-user-role'];
      const userEmail = headers['x-user-email'];

      if (!userId) {
         set.status = 401;
         throw new Error('Missing user authentication from gateway');
      }

      if (userRole !== 'admin') {
         set.status = 401;
         throw new Error('Only admin can access this API');
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

   .post('/', async ({ body, set, notificationService }) => {
      try {
         // Validate empty strings before passing to service
         if (!body.templateKey || body.templateKey.trim() === '') {
            set.status = 422;
            return {
               success: false,
               error: 'Template key cannot be empty'
            };
         }

         if (!body.content || body.content.trim() === '') {
            set.status = 422;
            return {
               success: false,
               error: 'Content cannot be empty'
            };
         }

         const template = await notificationService.createTemplate(body);
         return {
            success: true,
            data: template
         }
      } catch (error) {
         set.status = 400;
         return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to create template'
         }
      }
   }, {
      body: t.Object({
         templateKey: t.String(),
         templateType: t.Union([t.Literal('email'), t.Literal('sms'), t.Literal('push')]),
         subject: t.Optional(t.String()),
         content: t.String(),
         variables: t.Optional(t.Array(t.String()))
      })
   });