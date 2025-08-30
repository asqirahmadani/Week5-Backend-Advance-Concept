import { db, type Database } from "../db/client";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import type { NewReview, NewReviewResponse, NewReviewHelpful } from "../db/schema";
import { reviews, reviewResponses, reviewHelpful, reviewReports } from "../db/schema";

export class ReviewService {
   private db: Database;

   constructor(injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
   }

   private validateRating(rating: number, field: string) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
         throw new Error(`${field} must be an integer between 1 and 5`);
      }
   }

   private async updateRestaurantRating(restaurantId: string) {
      const stats = await this.getRestaurantStats(restaurantId);

      // This would typically call restaurant service to update the rating
      // For now, we'll just log it
      console.log(`Restaurant ${restaurantId} new average rating: ${stats.averageRating}`);

      // In real implementation, make HTTP call to restaurant service:
      // await fetch(`http://localhost:3002/api/restaurants/${restaurantId}/rating`, {
      //   method: 'PATCH',
      //   body: JSON.stringify({ rating: stats.averageRating, totalReviews: stats.totalReviews })
      // });
   }

   async createReview(data: {
      orderId: string;
      customerId: string;
      restaurantId: string;
      driverId?: string;
      restaurantRating: number;
      driverRating?: number;
      foodQuality: number;
      deliveryTime: number;
      restaurantComment?: string;
      driverComment?: string;
   }) {
      this.validateRating(data.restaurantRating, 'restaurant rating');
      this.validateRating(data.foodQuality, 'food quality');
      this.validateRating(data.deliveryTime, 'delivery time');
      if (data.driverRating) this.validateRating(data.driverRating, 'driver rating');

      // checl if review already exists for this order
      const existingReview = await this.db.select()
         .from(reviews)
         .where(eq(reviews.orderId, data.orderId));

      if (existingReview.length > 0) {
         throw new Error('Review already exists for this order');
      }

      const [review] = await this.db.insert(reviews)
         .values(data)
         .returning();

      return review;
   }

   async deleteReview(reviewId: string) {
      try {
         // delete any related data
         await this.db.delete(reviewHelpful)
            .where(eq(reviewHelpful.reviewId, reviewId));

         await this.db.delete(reviewResponses)
            .where(eq(reviewResponses.reviewId, reviewId));

         await this.db.delete(reviewReports)
            .where(eq(reviewReports.reviewId, reviewId));

         // delete the review itself
         const [deletedReview] = await this.db.delete(reviews)
            .where(eq(reviews.id, reviewId))
            .returning();

         if (!deletedReview) {
            throw new Error('Review not found');
         }

         console.log(`Review ${reviewId} deleted successfully (compensation action)`);
         return { success: true, deletedReview };
      } catch (error) {
         console.error('Failed to delete review:', error);
         throw new Error(`Failed to delete review: ${error instanceof Error ? error.message : error}`);
      }
   }

   async getRestaurantReviews(restaurantId: string, page: number = 1, limit: number = 10) {
      const offset = (page - 1) * limit;

      const reviewList = await this.db
         .select({
            id: reviews.id,
            orderId: reviews.orderId,
            customerId: reviews.customerId,
            restaurantRating: reviews.restaurantRating,
            foodQuality: reviews.foodQuality,
            deliveryTime: reviews.deliveryTime,
            restaurantComment: reviews.restaurantComment,
            createdAt: reviews.createdAt,
            helpfulCount: sql<number>`COALESCE((
               SELECT COUNT(*)
               FROM ${reviewHelpful}
               WHERE ${reviewHelpful.reviewId} = ${reviews.id}
               AND ${reviewHelpful.isHelpful} = true
            ), 0)`,
            responses: sql<any[]>`COALESCE((
               SELECT json_agg(json_build_object(
                  'id', ${reviewResponses.id},
                  'response', ${reviewResponses.response},
                  'responderType', ${reviewResponses.responderType},
                  'createdAt', ${reviewResponses.createdAt}
               ))
               FROM ${reviewResponses}
               WHERE ${reviewResponses.reviewId} = ${reviews.id}
            ), '[]'::json)`,
         })
         .from(reviews)
         .where(and(
            eq(reviews.restaurantId, restaurantId),
            eq(reviews.isVisible, true)
         ))
         .orderBy(desc(reviews.createdAt))
         .limit(limit)
         .offset(offset);

      return reviewList;
   }

   async getRestaurantStats(restaurantId: string) {
      const stats = await this.db
         .select({
            totalReviews: sql<number>`COUNT(*)`,
            averageRating: sql<number>`ROUND(AVG(${reviews.restaurantRating}), 2)`,
            averageFoodQuality: sql<number>`ROUND(AVG(${reviews.foodQuality}), 2)`,
            averageDeliveryTime: sql<number>`ROUND(AVG(${reviews.deliveryTime}), 2)`,
            fiveStars: sql<number>`COUNT(CASE WHEN ${reviews.restaurantRating} = 5 THEN 1 END)`,
            fourStars: sql<number>`COUNT(CASE WHEN ${reviews.restaurantRating} = 4 THEN 1 END)`,
            threeStars: sql<number>`COUNT(CASE WHEN ${reviews.restaurantRating} = 3 THEN 1 END)`,
            twoStars: sql<number>`COUNT(CASE WHEN ${reviews.restaurantRating} = 2 THEN 1 END)`,
            oneStar: sql<number>`COUNT(CASE WHEN ${reviews.restaurantRating} = 1 THEN 1 END)`,
         })
         .from(reviews)
         .where(and(
            eq(reviews.restaurantId, restaurantId),
            eq(reviews.isVisible, true)
         ));

      return stats[0];
   }

   async addReviewResponse(data: {
      reviewId: string;
      responderId: string;
      responderType: 'restaurant' | 'admin';
      response: string;
   }) {
      const [response] = await this.db.insert(reviewResponses)
         .values(data)
         .returning();

      return response;
   }

   async markReviewHelpful(reviewId: string, userId: string, isHelpful: boolean) {
      const helpfulData: NewReviewHelpful = {
         reviewId,
         userId,
         isHelpful
      };

      const [helpful] = await this.db.insert(reviewHelpful)
         .values(helpfulData)
         .onConflictDoUpdate({
            target: [reviewHelpful.reviewId, reviewHelpful.userId],
            set: { isHelpful, updatedAt: new Date() },
         })
         .returning();

      return helpful;
   }

   async reportReview(data: {
      reviewId: string;
      reporterId: string;
      reason: 'spam' | 'inappropriate' | 'fake' | 'offensive' | 'other';
      description?: string;
   }) {
      const [report] = await this.db.insert(reviewReports)
         .values(data)
         .returning();

      return report;
   }

   async getCustomerReviews(customerId: string) {
      const customerReviews = await this.db.select()
         .from(reviews)
         .where(eq(reviews.customerId, customerId))
         .orderBy(desc(reviews.createdAt));

      return customerReviews;
   }

   async getDriverReviews(driverId: string) {
      const driverReviews = await this.db
         .select({
            id: reviews.id,
            orderId: reviews.orderId,
            customerId: reviews.customerId,
            driverRating: reviews.driverRating,
            deliveryTime: reviews.deliveryTime,
            driverComment: reviews.driverComment,
            createdAt: reviews.createdAt,
         })
         .from(reviews)
         .where(and(
            eq(reviews.driverId, driverId),
            eq(reviews.isVisible, true)
         ))
         .orderBy(desc(reviews.createdAt));

      return driverReviews;
   }

   async getDriverStats(driverId: string) {
      const stats = await this.db
         .select({
            totalReviews: sql<number>`COUNT(*)`,
            averageRating: sql<number>`ROUND(AVG(${reviews.driverRating}), 2)`,
            averageDeliveryTime: sql<number>`ROUND(AVG(${reviews.deliveryTime}), 2)`,
         })
         .from(reviews)
         .where(and(
            eq(reviews.driverId, driverId),
            eq(reviews.isVisible, true)
         ));

      return stats[0];
   }

   async getReportedReviews(status?: 'pending' | 'reviewed' | 'resolved' | 'rejected') {
      let query = this.db
         .select({
            report: reviewReports,
            review: reviews
         })
         .from(reviewReports)
         .innerJoin(reviews, eq(reviewReports.reviewId, reviews.id));

      if (status) {
         return await query.where(eq(reviewReports.status, status)).orderBy(desc(reviewReports.createdAt));
      } else {
         return await query.orderBy(desc(reviewReports.createdAt));
      }
   }

   async resolverReviewReport(reportId: string, adminId: string, action: 'resolve' | 'reject') {
      const [updated] = await this.db.update(reviewReports)
         .set({
            status: action === 'resolve' ? 'resolved' : 'rejected',
            reviewedBy: adminId,
            updatedAt: new Date()
         })
         .where(eq(reviewReports.id, reportId))
         .returning();

      if (action === 'resolve' && updated) {
         await this.db.update(reviews)
            .set({ isVisible: false, updatedAt: new Date() })
            .where(eq(reviews.id, updated.reviewId));
      }

      return updated;
   }
}