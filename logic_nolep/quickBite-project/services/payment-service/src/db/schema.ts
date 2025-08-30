import { pgTable, uuid, varchar, decimal, timestamp, pgEnum, text, integer, boolean } from 'drizzle-orm/pg-core';

export const paymentMethodEnum = pgEnum('payment_method', ['card', 'wallet', 'cash']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'processing', 'succeeded', 'failed', 'cancelled']);
export const refundReasonEnum = pgEnum('refund_reason', ['customer_request', 'restaurant_cancelled', 'driver_unavailable', 'food_quality', 'other']);
export const refundStatusEnum = pgEnum('refund_status', ['pending', 'processing', 'succeeded', 'failed']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'processing', 'paid']);
export const settlementStatusEnum = pgEnum('settlement_status', ['pending', 'processing', 'paid']);

export const payments = pgTable('payments', {
   id: uuid('id').defaultRandom().primaryKey(),
   orderId: uuid('order_id').notNull(),
   userId: uuid('user_id').notNull(),
   stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
   amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
   currency: varchar('currency', { length: 3 }).notNull().default('USD'),
   paymentMethod: paymentMethodEnum('payment_method').notNull(),
   status: paymentStatusEnum('status').notNull().default('pending'),
   fees: decimal('fees', { precision: 10, scale: 2 }).default('0'),
   metadata: text('metadata'),
   createdAt: timestamp('created_at').notNull().defaultNow(),
   updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const refunds = pgTable('refunds', {
   id: uuid('id').defaultRandom().primaryKey(),
   paymentId: uuid('payment_id').notNull().references(() => payments.id),
   orderId: uuid('order_id').notNull(),
   stripeRefundId: varchar('stripe_refund_id', { length: 255 }).unique(),
   amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
   reason: refundReasonEnum('reason').notNull(),
   description: text('description'),
   status: refundStatusEnum('status').notNull().default('pending'),
   requestedBy: uuid('requested_by').notNull(),
   processedBy: uuid('processed_by'),
   requestedAt: timestamp('requested_at').notNull().defaultNow(),
   processedAt: timestamp('processed_at')
});

export const driverEarnings = pgTable('driver_earnings', {
   id: uuid('id').defaultRandom().primaryKey(),
   driverId: uuid('driver_id').notNull(),
   orderId: uuid('order_id').notNull(),
   baseEarning: decimal('base_earning', { precision: 10, scale: 2 }).notNull(),
   tipAmount: decimal('tip_amount', { precision: 10, scale: 2 }).default('0'),
   bonusAmount: decimal('bonus_amount', { precision: 10, scale: 2 }).default('0'),
   totalEarning: decimal('total_earning', { precision: 10, scale: 2 }).notNull(),
   payoutStatus: payoutStatusEnum('payout_status').default('pending'),
   payoutDate: timestamp('payout_date'),
   stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
   createdAt: timestamp('created_at').notNull().defaultNow()
});

export const restaurantSettlements = pgTable('restaurant_settlements', {
   id: uuid('id').defaultRandom().primaryKey(),
   restaurantId: uuid('restaurant_id').notNull(),
   orderId: uuid('order_id').notNull(),
   grossAmount: decimal('gross_amount', { precision: 10, scale: 2 }).notNull(),
   commissionRate: decimal('commission_rate', { precision: 5, scale: 4 }).notNull(),
   commissionAmount: decimal('commission_amount', { precision: 10, scale: 2 }).notNull(),
   netAmount: decimal('net_amount', { precision: 10, scale: 2 }).notNull(),
   settlementStatus: settlementStatusEnum('settlement_status').default('pending'),
   settlementDate: timestamp('settlement_date'),
   stripeTransferId: varchar('stripe_transfer_id', { length: 255 }),
   createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Refund = typeof refunds.$inferSelect;
export type NewRefund = typeof refunds.$inferInsert;
export type DriverEarning = typeof driverEarnings.$inferSelect;
export type NewDriverEarning = typeof driverEarnings.$inferInsert;
export type RestaurantSettlement = typeof restaurantSettlements.$inferSelect;
export type NewRestaurantSettlement = typeof restaurantSettlements.$inferInsert;