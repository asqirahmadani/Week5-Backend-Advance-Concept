import { pgTable, uuid, decimal, boolean, timestamp, text, integer } from 'drizzle-orm/pg-core';

export const deliveryAssignment = pgTable('delivery_assignments', {
   id: uuid('id').defaultRandom().primaryKey(),
   orderId: uuid('order_id').notNull(),
   driverId: uuid('driver_id').notNull(),
   status: text('status', {
      enum: ['assigned', 'accepted', 'picked_up', 'delivered', 'cancelled']
   }).default('assigned'),
   assignedAt: timestamp('assigned_at').defaultNow(),
   acceptedAt: timestamp('accepeted_at'),
   pickedUpAt: timestamp('picked_up_at'),
   deliveredAt: timestamp('delivered_at'),
   estimatedDeliveryTime: timestamp('estimated_delivery_time'),
   actualDeliveryTime: timestamp('actual_delivery_time'),
   deliveryAddress: text('delivery_address').notNull(),
   customerPhone: text('customer_phone'),
   restaurantAddress: text('restaurant_address'),
   notes: text('notes'),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const driverLocations = pgTable('driver_locations', {
   driverId: uuid('driver_id').primaryKey(),
   latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
   longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
   timestamp: timestamp('timestamp').defaultNow(),
   isOnline: boolean('is_online').default(false),
   lastUpdated: timestamp('last_updated').defaultNow()
});

export const deliveryTracking = pgTable('delivery_tracking', {
   id: uuid('id').defaultRandom().primaryKey(),
   deliveryId: uuid('delivery_id').notNull().references(() => deliveryAssignment.id),
   latitude: decimal('latitude', { precision: 10, scale: 8 }).notNull(),
   longitude: decimal('longitude', { precision: 11, scale: 8 }).notNull(),
   timestamp: timestamp('timestamp').defaultNow(),
   status: text('status'),
   notes: text('notes')
});

export type DeliveryAssignment = typeof deliveryAssignment.$inferSelect;
export type NewDeliveryAssignment = typeof deliveryAssignment.$inferInsert;
export type DriverLocation = typeof driverLocations.$inferSelect;
export type NewDriverLocation = typeof driverLocations.$inferInsert;
export type DeliveryTracking = typeof deliveryTracking.$inferSelect;
export type NewDeliveryTracking = typeof deliveryTracking.$inferInsert;