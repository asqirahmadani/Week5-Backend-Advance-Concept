import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { users, rooms } from './index';

export const roomMembers = pgTable('room_members', {
    id: serial('id').primaryKey(),
    roomId: integer('room_id').references(() => rooms.id, { onDelete: 'cascade' }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('member'),
    joinedAt: timestamp('joined_at').defaultNow()
});