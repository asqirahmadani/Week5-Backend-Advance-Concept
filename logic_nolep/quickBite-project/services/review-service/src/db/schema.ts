import { pgTable, uuid, text, integer, timestamp, decimal, boolean } from 'drizzle-orm/pg-core';

export const reviews = pgTable('reviews', {
   id: uuid('id').defaultRandom().primaryKey(),
   orderId: uuid('order_id').notNull().unique(),
   customerId: uuid('customer_id').notNull(),
   restaurantId: uuid('restaurant_id').notNull(),
   driverId: uuid('driver_id'),

   // rating (1 - 5 stars)
   restaurantRating: integer('restaurant_rating').notNull(),
   driverRating: integer('driver_rating'),
   foodQuality: integer('food_quality').notNull(),
   deliveryTime: integer('delivery_time').notNull(),

   // comments
   restaurantComment: text('restaurant_comment'),
   driverComment: text('driver_comment'),

   // metadata
   isVerified: boolean('is_verified').default(true),
   isVisible: boolean('is_visible').default(true),

   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const reviewResponses = pgTable('review_responses', {
   id: uuid('id').defaultRandom().primaryKey(),
   reviewId: uuid('review_id').notNull().references(() => reviews.id),
   responderId: uuid('responder_id').notNull(),    // restaurant owner or admin
   responderType: text('responder_type', { enum: ['restaurant', 'admin'] }).notNull(),
   response: text('respons').notNull(),
   createdAt: timestamp('created_at').defaultNow()
});

export const reviewHelpful = pgTable('review_helpful', {
   id: uuid('id').defaultRandom().primaryKey(),
   reviewId: uuid('review_id').notNull().references(() => reviews.id),
   userId: uuid('user_id').notNull(),
   isHelpful: boolean('is_helpful').notNull(),
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export const reviewReports = pgTable('review_reports', {
   id: uuid('id').defaultRandom().primaryKey(),
   reviewId: uuid('review_id').notNull().references(() => reviews.id),
   reporterId: uuid('reporter_id').notNull(),
   reason: text('reason', {
      enum: ['spam', 'inappropriate', 'fake', 'offensive', 'other']
   }).notNull(),
   description: text('description'),
   status: text('status', {
      enum: ['pending', 'reviewed', 'resolved', 'rejected']
   }).default('pending'),
   reviewedBy: uuid('reviewed_by'),    // admin who reviewed the report
   createdAt: timestamp('created_at').defaultNow(),
   updatedAt: timestamp('updated_at').defaultNow()
});

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type ReviewResponse = typeof reviewResponses.$inferSelect;
export type NewReviewResponse = typeof reviewResponses.$inferInsert;
export type ReviewHelpful = typeof reviewHelpful.$inferSelect;
export type NewReviewHelpful = typeof reviewHelpful.$inferInsert;