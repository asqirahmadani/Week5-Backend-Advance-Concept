import { logger } from "@/middleware/logger";
import { BaseOrchestrator } from "./base.orchestrator";
import type { OrchestrationStep, OrderOrchestrationData, ReviewOrchestrationData } from "@/types";

interface CreateReviewRequest {
   orderId: string;
   restaurantId: string;
   restaurantRating: number;
   foodQuality: number;
   deliveryTime: number;
   restaurantComment: string;
}

export class ReviewFlowOrchestrator extends BaseOrchestrator {
   async createReview(
      userId: string,
      userEmail: string,
      userRole: string,
      reviewData: CreateReviewRequest
   ): Promise<{
      success: boolean;
      data?: ReviewOrchestrationData;
      error?: string;
      transactionId: string
   }> {
      const steps: OrchestrationStep[] = [
         {
            stepName: 'create_review',
            service: 'review',
            endpoint: '/api/reviews',
            method: 'POST',
            payload: {
               ...reviewData
            },
            compensationEndpoint: '/api/reviews/{{reviewId}}',
            compensationMethod: 'DELETE',
            compensationPayload: {}
         },
         {
            stepName: 'update_restaurant_stats',
            service: 'restaurant',
            endpoint: `/api/restaurant/${reviewData.restaurantId}/rating`,
            method: 'PATCH',
            payload: {
               newRating: reviewData.restaurantRating,
               reviewId: '{{reviewId}}'
            }
         }
      ];

      const context = this.createContext(userId, userEmail, userRole, steps);
      const orchestrationData: ReviewOrchestrationData = {};

      logger.info({
         transactionId: context.transactionId,
         userId,
         reviewData
      }, 'Starting review creation orchestration');

      try {
         // step 1: Create Review
         const reviewResult = await this.executeStep(steps[0], context, {
            customerId: userId
         });

         orchestrationData.reviewId = reviewResult.id;
         orchestrationData.restaurantId = reviewData.restaurantId;

         // step 2: Update Restaurant Rating
         const ratingResult = await this.executeStep(steps[1], context, {
            reviewId: reviewResult.id
         });

         orchestrationData.updatedRating = ratingResult.newAverageRating;
         orchestrationData.totalReviews = ratingResult.totalReviews;

         logger.info({
            transactionId: context.transactionId,
            orchestrationData
         }, 'Review creation orchestration completed successfully');

         return {
            success: true,
            data: orchestrationData,
            transactionId: context.transactionId
         };
      } catch (error: any) {
         await this.handleOrchestrationFailure(context, error.stepName || 'unknown', error);

         return {
            success: false,
            error: `Review creation failed: ${error.message}`,
            transactionId: context.transactionId
         };
      }
   }
}