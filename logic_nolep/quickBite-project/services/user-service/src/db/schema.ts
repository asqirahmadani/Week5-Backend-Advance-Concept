import { pgTable, pgEnum, varchar, text, timestamp, uuid, boolean, integer, decimal } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('user_role', ['customer', 'driver', 'restaurant_owner', 'admin']);
export const statusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended']);

export const users = pgTable('users', {
   id: uuid('id').defaultRandom().primaryKey(),
   fullName: varchar('full_name', { length: 255 }).notNull(),
   email: varchar('email', { length: 255 }).notNull().unique(),
   password: varchar('password', { length: 255 }).notNull(),
   phone: varchar('phone', { length: 50 }),
   role: roleEnum('role').default('customer'),
   status: statusEnum('status').default('active'),
   address: varchar('address', { length: 500 }),
   city: varchar('city', { length: 255 }),
   stripeAccountId: varchar('stripe_account_id', { length: 255 }),
   stripeOnboardingCompleted: boolean('stripe_onboarding_completed').default(false),
   stripeCreatedAt: timestamp('stripe_created_at'),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const userSession = pgTable('user_sessions', {
   id: uuid('id').defaultRandom().primaryKey(),
   userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
   tokenHash: varchar('token_hash'),
   expiresAt: timestamp('expires_at'),
   createdAt: timestamp('created_at').defaultNow()
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserSession = typeof userSession.$inferSelect;
export type NewUserSession = typeof userSession.$inferInsert;