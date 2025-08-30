import { pgTable, uuid, text, boolean, timestamp, integer, json } from 'drizzle-orm/pg-core';

export const notificationTemplates = pgTable('notification_templates', {
   id: uuid('id').defaultRandom().primaryKey(),
   templateKey: text('template_key').notNull().unique(),
   templateType: text('template_type', { enum: ['email', 'sms', 'push'] }).notNull(),
   subject: text('subject'),
   content: text('content').notNull(),
   variables: json('variables').$type<string[]>(),
   isActive: boolean('is_active').default(true),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const notificationQueue = pgTable('notification_queue', {
   id: uuid('id').defaultRandom().primaryKey(),
   userId: uuid('user_id').notNull(),
   templateKey: text('template_key').notNull(),
   notificationType: text('notification_type', { enum: ['email', 'sms', 'push'] }).notNull(),
   recipient: text('recipient').notNull(),   // email, phone, or device token
   subject: text('subject'),
   content: text('content').notNull(),
   variables: json('variables').$type<Record<string, any>>(),
   status: text('status', { enum: ['pending', 'processing', 'sent', 'failed', 'retry'] }).default('pending'),
   scheduledAt: timestamp('scheduled_at').defaultNow(),
   sentAt: timestamp('sent_at'),
   retryCount: integer('retry_count').default(0),
   errorMessage: text('error_message'),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const notificationLogs = pgTable('notification_logs', {
   id: uuid('id').defaultRandom().primaryKey(),
   queueId: uuid('queue_id').notNull().references(() => notificationQueue.id),
   status: text('status').notNull(),
   response: json('response').$type<Record<string, any>>(),
   timestamp: timestamp('timestamp').defaultNow()
});

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert;
export type NotificationQueue = typeof notificationQueue.$inferSelect;
export type NewNotificationQueue = typeof notificationQueue.$inferInsert;
export type NotificationLog = typeof notificationLogs.$inferSelect;
export type NewNotificationLog = typeof notificationLogs.$inferInsert;