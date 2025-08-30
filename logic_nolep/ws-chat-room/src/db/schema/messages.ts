import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { users, rooms } from './index';

export const messages = pgTable('messages', {
    id: serial('id').primaryKey(),
    content: text('content').notNull(),
    userId: integer('user_id').references(() => users.id),
    roomId: integer('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow(),
    isEdited: boolean('is_edited').default(false),
    editedAt: timestamp('edited_at'),
    isDeleted: boolean('is_deleted').default(false),
    deletedAt: timestamp('deleted_at')
});