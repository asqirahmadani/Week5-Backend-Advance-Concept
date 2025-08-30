import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const rooms = pgTable('rooms', {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
    createdBy: integer('created_by').references(() => users.id),
    isPrivate: boolean('is_private').default(false),
    password: text('password'),
    createdAt: timestamp('created_at').defaultNow()
});