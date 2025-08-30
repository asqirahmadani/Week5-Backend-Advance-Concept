import { pgTable, boolean, varchar, timestamp, uuid, integer, decimal } from 'drizzle-orm/pg-core';

export const restaurant = pgTable('restaurant', {
   id: uuid('id').defaultRandom().primaryKey(),
   ownerId: uuid('owner_id').notNull(),
   name: varchar('name', { length: 255 }).notNull(),
   description: varchar('description', { length: 500 }),
   cuisineType: varchar('cuisine_type'),
   address: varchar('address', { length: 500 }),
   city: varchar('city', { length: 100 }),
   latitude: decimal('latitude', { precision: 10, scale: 8 }),
   longitude: decimal('longitude', { precision: 11, scale: 8 }),
   phone: varchar('phone', { length: 20 }),
   email: varchar('email', { length: 100 }).notNull().unique(),
   rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
   totalReviews: integer('total_reviews').default(0),
   isActive: boolean('is_active').default(true),
   isVerified: boolean('is_verified').default(false),
   deliveryFee: decimal('delivery_fee', { precision: 8, scale: 2 }).default('3.00'),
   minimumOrder: decimal('minimum_order', { precision: 8, scale: 2 }).default('1.00'),
   estimatedPrepTime: integer('estimated_prep_time').default(10),
   isOpen: boolean('is_open').default(true),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const menuCategories = pgTable('menu_categories', {
   id: uuid('id').defaultRandom().primaryKey(),
   restaurantId: uuid('restaurant_id').references(() => restaurant.id, { onDelete: 'cascade' }),
   name: varchar('name', { length: 255 }).notNull(),
   description: varchar('description', { length: 500 }),
   sortOrder: integer('sort_order').default(0),
   isActive: boolean('is_active').default(true)
});

export const menuItems = pgTable('menu_items', {
   id: uuid('id').defaultRandom().primaryKey(),
   restaurantId: uuid('restaurant_id').references(() => restaurant.id, { onDelete: 'cascade' }),
   categoryId: uuid('category_id').references(() => menuCategories.id, { onDelete: 'cascade' }),
   name: varchar('name', { length: 255 }).notNull(),
   description: varchar('description', { length: 500 }),
   price: decimal('price', { precision: 8, scale: 2 }).notNull(),
   isAvailable: boolean('is_available').default(true),
   preparationTime: integer('preparation_time').default(5),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export type Restaurant = typeof restaurant.$inferInsert;
export type NewRestaurant = typeof restaurant.$inferInsert;
export type MenuCategories = typeof menuCategories.$inferInsert;
export type NewMenuCategories = typeof menuCategories.$inferInsert;
export type MenuItems = typeof menuItems.$inferInsert;
export type NewMenuItems = typeof menuItems.$inferInsert;