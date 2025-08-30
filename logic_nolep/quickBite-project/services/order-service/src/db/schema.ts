import { pgTable, pgEnum, varchar, text, timestamp, time, uuid, integer, decimal } from 'drizzle-orm/pg-core';

export const orderStatusEnum = pgEnum('order_status', [
   'pending',
   'confirmed',
   'preparing',
   'ready',
   'picked_up',
   'delivered',
   'cancelled',
   'refunded'
]);

export const paymentStatusEnum = pgEnum('payment', [
   'pending',
   'paid',
   'refunded',
   'failed'
]);

export const orders = pgTable('orders', {
   id: uuid('id').defaultRandom().primaryKey(),
   orderNumber: varchar('order_number', { length: 20 }).unique().notNull(),
   customerId: uuid('customer_id').notNull(),
   restaurantId: uuid('restaurant_id').notNull(),
   driverId: uuid('driver_id'),
   status: orderStatusEnum('status').default('pending').notNull(),
   subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
   deliveryFee: decimal('delivery_fee', { precision: 10, scale: 2 }).notNull().default('0'),
   totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
   refundAmount: decimal('refund_amount', { precision: 10, scale: 2 }).default('0').notNull(),
   paymentStatus: paymentStatusEnum('payment_status').default('pending'),
   deliveryAddress: varchar('delivery_address').notNull(),
   estimatedDeliveryTime: timestamp('estimated_delivery_time'),
   actualDeliveryTime: timestamp('actual_delivery_time'),
   createdAt: timestamp('created_at').defaultNow().notNull(),
   updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const orderItems = pgTable('order_items', {
   id: uuid('id').defaultRandom().primaryKey(),
   orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
   menuItemId: uuid('menu_item_id').notNull(),
   menuItemName: varchar('menu_item_name', { length: 255 }).notNull(),
   quantity: integer('quantity').notNull(),
   unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
   totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
   createdAt: timestamp('created_at').defaultNow().notNull()
});

export const orderStatusHistory = pgTable('order_status_history', {
   id: uuid('id').defaultRandom().primaryKey(),
   orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }).notNull(),
   status: varchar('status', { length: 20 }).notNull(),
   changedAt: timestamp('changed_at').defaultNow().notNull(),
   notes: text('notes')
});