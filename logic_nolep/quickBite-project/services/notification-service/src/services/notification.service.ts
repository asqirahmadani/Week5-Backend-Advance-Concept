import { eq, and, sql } from "drizzle-orm";
import { EmailService } from "./email.service";
import { db, type Database } from "../db/client";
import type { NewNotificationQueue, NewNotificationLog } from "../db/schema";
import { notificationTemplates, notificationQueue, notificationLogs } from "../db/schema";

export class NotificationService {
   private db: Database
   private emailService: EmailService;

   constructor(injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
      this.emailService = new EmailService();
   }

   // create notification template
   async createTemplate(data: {
      templateKey: string;
      templateType: 'email' | 'sms' | 'push';
      subject?: string;
      content: string;
      variables?: string[];
   }) {
      const [template] = await this.db.insert(notificationTemplates)
         .values(data)
         .returning();

      return template;
   }

   // queue notification
   async queueNotification(userId: string, data: {
      templateKey: string;
      templateType?: 'email' | 'sms' | 'push';
      notificationType: 'email' | 'sms' | 'push';
      recipient: string;
      variables?: Record<string, any>;
      scheduledAt?: Date;
   }) {
      const notificationType = data.templateType || data.notificationType;
      if (!notificationType) {
         throw new Error('Either templateType or notificationType must be specified');
      }

      const template = await this.db.select()
         .from(notificationTemplates)
         .where(and(
            eq(notificationTemplates.templateKey, data.templateKey),
            eq(notificationTemplates.templateType, notificationType),
            eq(notificationTemplates.isActive, true)
         ));

      if (!template[0]) {
         throw new Error(`Template not found: ${data.templateKey}`);
      }

      // Process template variables
      let processedContent = template[0].content;
      let processedSubject = template[0].subject || '';

      if (data.variables) {
         for (const [key, value] of Object.entries(data.variables)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            processedContent = processedContent.replace(placeholder, String(value));
            processedSubject = processedSubject.replace(placeholder, String(value));
         }
      }

      const queueData: NewNotificationQueue = {
         userId: userId,
         templateKey: data.templateKey,
         notificationType: data.notificationType,
         recipient: data.recipient,
         subject: processedSubject,
         content: processedContent,
         variables: data.variables,
         scheduledAt: data.scheduledAt || new Date()
      };

      const [queued] = await this.db.insert(notificationQueue)
         .values(queueData)
         .returning();

      const now = new Date();
      if (queued.scheduledAt! <= now || queued.scheduledAt === null) {
         setTimeout(async () => {
            try {
               await this.processNotifications(queued.id);
            } catch (error) {
               console.error(`Failed to auto-process notification ${queued.id}:`, error);
            }
         }, 100)
      }

      return {
         notificationId: queued.id,
         ...queued
      }
   }

   async processPendingNotifications() {
      const pending = await this.db.select()
         .from(notificationQueue)
         .where(and(
            eq(notificationQueue.status, 'pending'),
            sql`${notificationQueue.scheduledAt} <= NOW()`
         ))
         .limit(10);

      const results = [];
      for (const notification of pending) {
         const result = await this.processNotifications(notification.id);
         results.push(result);
      }

      return results;
   }

   async processNotifications(queueId: string) {
      const notification = await this.db.select()
         .from(notificationQueue)
         .where(eq(notificationQueue.id, queueId));

      if (!notification[0]) {
         return { success: false, error: 'Notification not found' };
      }

      const item = notification[0];

      try {
         // update status to processing
         await this.db.update(notificationQueue)
            .set({ status: 'processing', updatedAt: new Date() })
            .where(eq(notificationQueue.id, queueId));

         let result;
         switch (item.notificationType) {
            case 'email':
               result = await this.emailService.sendEmail(
                  item.recipient,
                  item.subject || '',
                  item.content,
                  item.variables as Record<string, any>
               );
               break;
            case 'sms':
               // Implement SMS service here
               result = { success: true, messageId: 'sms-mock' };
               break;
            case 'push':
               // Implement Push notification service
               result = { success: true, messageId: 'push-mock' };
               break;
            default:
               result = { success: false, error: 'Unsupported notification type' };
         }

         // update notification status
         const status = result.success ? 'sent' : 'failed';
         await this.db.update(notificationQueue)
            .set({
               status,
               sentAt: result.success ? new Date() : undefined,
               errorMessage: result.success ? undefined : result.error,
               retryCount: result.success ? item.retryCount : item.retryCount! + 1,
               updatedAt: new Date()
            })
            .where(eq(notificationQueue.id, queueId));

         // log the result
         await this.logNotification(queueId, status, result);

         return { success: result.success, queueId };
      } catch (error) {
         await this.db.update(notificationQueue)
            .set({
               status: 'failed',
               errorMessage: error instanceof Error ? error.message : 'Unknown error',
               retryCount: item.retryCount! + 1,
               updatedAt: new Date()
            })
            .where(eq(notificationQueue.id, queueId));

         await this.logNotification(queueId, 'failed', { error: error instanceof Error ? error.message : 'Unknown error' });

         return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
   }

   async logNotification(queueId: string, status: string, response: any) {
      const logData: NewNotificationLog = {
         queueId,
         status,
         response
      };

      await this.db.insert(notificationLogs).values(logData);
   }

   async getNotificationHistory(userId: string, limit: number = 50) {
      const history = await this.db.select()
         .from(notificationQueue)
         .where(eq(notificationQueue.userId, userId))
         .orderBy(sql`${notificationQueue.createdAt} DESC`)
         .limit(limit);

      return history;
   }

   async getNotificationStats(days: number = 30) {
      const stats = await this.db
         .select({
            status: notificationQueue.status,
            type: notificationQueue.notificationType,
            count: sql<number>`count(*)`
         })
         .from(notificationQueue)
         .where(sql`${notificationQueue.createdAt} >= NOW() - INTERVAL '${days} days'`)
         .groupBy(notificationQueue.status, notificationQueue.notificationType);

      return stats;
   }

   async retryFailedNotifications(maxRetries: number = 3) {
      const failed = await this.db.select()
         .from(notificationQueue)
         .where(and(
            eq(notificationQueue.status, 'failed'),
            sql`${notificationQueue.retryCount} < ${maxRetries}`
         ))
         .limit(10);

      const results = [];
      for (const notification of failed) {
         await this.db.update(notificationQueue)
            .set({
               status: 'pending',
               scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // retry after 5 min
               updatedAt: new Date()
            })
            .where(eq(notificationQueue.id, notification.id));

         results.push({ queueId: notification.id, retryCount: notification.retryCount! + 1 });
      }

      return results;
   }
}