import { describe, test, expect, beforeEach, mock } from "bun:test";
import { ReviewService } from "../../src/services/review.service";

// Create a proper chainable mock that mimics Drizzle's behavior
function createChainableMock() {
   const chainMock = {
      select: mock(() => chainMock),
      insert: mock(() => chainMock),
      update: mock(() => chainMock),
      delete: mock(() => chainMock),
      from: mock(() => chainMock),
      where: mock(() => chainMock),
      values: mock(() => chainMock),
      returning: mock(() => Promise.resolve([])),
      innerJoin: mock(() => chainMock),
      orderBy: mock(() => chainMock),
      limit: mock(() => chainMock),
      offset: mock(() => chainMock),
      onConflictDoUpdate: mock(() => chainMock),
      set: mock(() => chainMock),
      // Add then method to make it thenable
      then: function (resolve: any, reject: any) {
         return this.returning().then(resolve, reject);
      }
   };
   return chainMock;
}

type status = "resolved" | "rejected" | "pending" | "reviewed";

// Mock console.log for testing
const consoleMock = mock();
global.console = { ...console, log: consoleMock };

describe("Review Service", () => {
   let reviewService: ReviewService;
   let mockDb: any;

   beforeEach(() => {
      // Create fresh mock database for each test
      mockDb = createChainableMock();
      consoleMock.mockClear();

      // Create service instance with mock database
      reviewService = new ReviewService(mockDb as any);
   });

   describe("createReview", () => {
      const validReviewData = {
         orderId: "order-123",
         customerId: "customer-123",
         restaurantId: "restaurant-123",
         driverId: "driver-123",
         restaurantRating: 4,
         driverRating: 5,
         foodQuality: 4,
         deliveryTime: 3,
         restaurantComment: "Great food!",
         driverComment: "Fast delivery"
      };

      test("should create review successfully", async () => {
         const mockReview = {
            id: "review-123",
            ...validReviewData,
            isVerified: true,
            isVisible: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         // Mock the chain: select().from().where() returns empty array (no existing review)
         mockDb.returning
            .mockResolvedValueOnce([]) // Check for existing review
            .mockResolvedValueOnce([mockReview]); // Insert new review

         const result = await reviewService.createReview(validReviewData);

         expect(result).toEqual(mockReview);
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.insert).toHaveBeenCalled();
         expect(mockDb.values).toHaveBeenCalledWith(validReviewData);
      });

      test("should throw error if review already exists", async () => {
         const existingReview = {
            id: "existing-review",
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            driverId: "driver-123",
            restaurantRating: 4,
            driverRating: 5,
            foodQuality: 4,
            deliveryTime: 3,
            restaurantComment: "Great food!",
            driverComment: "Fast delivery",
            isVerified: true,
            isVisible: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         // Mock existing review found
         mockDb.returning.mockResolvedValueOnce([existingReview]);

         await expect(reviewService.createReview(validReviewData)).rejects.toThrow(
            "Review already exists for this order"
         );

         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.insert).not.toHaveBeenCalled();
      });

      test("should validate restaurant rating", async () => {
         const invalidData = { ...validReviewData, restaurantRating: 6 };

         await expect(reviewService.createReview(invalidData)).rejects.toThrow(
            "restaurant rating must be an integer between 1 and 5"
         );
      });

      test("should validate food quality rating", async () => {
         const invalidData = { ...validReviewData, foodQuality: 0 };

         await expect(reviewService.createReview(invalidData)).rejects.toThrow(
            "food quality must be an integer between 1 and 5"
         );
      });

      test("should validate delivery time rating", async () => {
         const invalidData = { ...validReviewData, deliveryTime: 2.5 };

         await expect(reviewService.createReview(invalidData)).rejects.toThrow(
            "delivery time must be an integer between 1 and 5"
         );
      });

      test("should validate driver rating when provided", async () => {
         const invalidData = { ...validReviewData, driverRating: -1 };

         await expect(reviewService.createReview(invalidData)).rejects.toThrow(
            "driver rating must be an integer between 1 and 5"
         );
      });

      test("should allow undefined driver rating", async () => {
         const dataWithoutDriver = {
            orderId: "order-124",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            restaurantRating: 4,
            foodQuality: 4,
            deliveryTime: 3,
            restaurantComment: "Great food!"
         };
         const mockReview = {
            id: "review-124",
            ...dataWithoutDriver,
            driverId: null,
            driverRating: null,
            driverComment: null,
            isVerified: true,
            isVisible: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning
            .mockResolvedValueOnce([]) // No existing review
            .mockResolvedValueOnce([mockReview]); // Insert result

         const result = await reviewService.createReview(dataWithoutDriver);

         expect(result).toEqual(mockReview);
      });
   });

   describe("deleteReview", () => {
      test("should delete review and related data successfully", async () => {
         const reviewId = "review-123";
         const deletedReview = {
            id: reviewId,
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            driverId: "driver-123",
            restaurantRating: 4,
            driverRating: 5,
            foodQuality: 4,
            deliveryTime: 3,
            restaurantComment: "Great food!",
            driverComment: "Fast delivery",
            isVerified: true,
            isVisible: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         // Mock the delete operations - only the final delete returns data
         mockDb.returning.mockResolvedValue([deletedReview]);

         const result = await reviewService.deleteReview(reviewId);

         expect(result).toEqual({ success: true, deletedReview });
         expect(mockDb.delete).toHaveBeenCalledTimes(4); // helpful, responses, reports, review
         expect(consoleMock).toHaveBeenCalledWith(
            `Review ${reviewId} deleted successfully (compensation action)`
         );
      });

      test("should throw error if review not found", async () => {
         const reviewId = "non-existent-review";

         // Mock no review found (empty array)
         mockDb.returning.mockResolvedValue([]);

         await expect(reviewService.deleteReview(reviewId)).rejects.toThrow(
            "Failed to delete review: Review not found"
         );
      });

      test("should handle database errors", async () => {
         const reviewId = "review-123";
         const dbError = new Error("Database connection failed");

         // Mock database error on first delete operation
         mockDb.delete.mockImplementationOnce(() => {
            throw dbError;
         });

         await expect(reviewService.deleteReview(reviewId)).rejects.toThrow(
            "Failed to delete review: Database connection failed"
         );
      });
   });

   describe("getRestaurantReviews", () => {
      test("should get restaurant reviews with pagination", async () => {
         const restaurantId = "restaurant-123";
         const mockReviews = [
            {
               id: "review-1",
               orderId: "order-1",
               customerId: "customer-1",
               restaurantRating: 5,
               foodQuality: 5,
               deliveryTime: 4,
               restaurantComment: "Excellent!",
               createdAt: new Date(),
               helpfulCount: 3,
               responses: []
            }
         ];

         mockDb.returning.mockResolvedValue(mockReviews);

         const result = await reviewService.getRestaurantReviews(restaurantId, 1, 10);

         expect(result).toEqual(mockReviews);
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.limit).toHaveBeenCalledWith(10);
         expect(mockDb.offset).toHaveBeenCalledWith(0);
      });

      test("should handle pagination correctly", async () => {
         const restaurantId = "restaurant-123";
         const page = 2;
         const limit = 5;

         mockDb.returning.mockResolvedValue([]);

         await reviewService.getRestaurantReviews(restaurantId, page, limit);

         expect(mockDb.limit).toHaveBeenCalledWith(5);
         expect(mockDb.offset).toHaveBeenCalledWith(5); // (page - 1) * limit = (2 - 1) * 5 = 5
      });
   });

   describe("getRestaurantStats", () => {
      test("should return restaurant statistics", async () => {
         const restaurantId = "restaurant-123";
         const mockStats = {
            totalReviews: 100,
            averageRating: 4.2,
            averageFoodQuality: 4.3,
            averageDeliveryTime: 4.1,
            fiveStars: 45,
            fourStars: 30,
            threeStars: 15,
            twoStars: 7,
            oneStar: 3
         };

         mockDb.returning.mockResolvedValue([mockStats]);

         const result = await reviewService.getRestaurantStats(restaurantId);

         expect(result).toEqual(mockStats);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe("addReviewResponse", () => {
      test("should add review response successfully", async () => {
         const responseData = {
            reviewId: "review-123",
            responderId: "restaurant-123",
            responderType: "restaurant" as const,
            response: "Thank you for your feedback!"
         };
         const mockResponse = {
            id: "response-123",
            ...responseData,
            createdAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockResponse]);

         const result = await reviewService.addReviewResponse(responseData);

         expect(result).toEqual(mockResponse);
         expect(mockDb.insert).toHaveBeenCalled();
         expect(mockDb.values).toHaveBeenCalledWith(responseData);
      });
   });

   describe("markReviewHelpful", () => {
      test("should mark review as helpful", async () => {
         const reviewId = "review-123";
         const userId = "user-123";
         const isHelpful = true;
         const mockHelpful = {
            id: "helpful-123",
            reviewId,
            userId,
            isHelpful,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockHelpful]);

         const result = await reviewService.markReviewHelpful(reviewId, userId, isHelpful);

         expect(result).toEqual(mockHelpful);
         expect(mockDb.insert).toHaveBeenCalled();
         expect(mockDb.onConflictDoUpdate).toHaveBeenCalled();
      });

      test("should mark review as not helpful", async () => {
         const reviewId = "review-123";
         const userId = "user-123";
         const isHelpful = false;
         const mockHelpful = {
            id: "helpful-123",
            reviewId,
            userId,
            isHelpful,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockHelpful]);

         const result = await reviewService.markReviewHelpful(reviewId, userId, isHelpful);

         expect(result).toEqual(mockHelpful);
      });
   });

   describe("reportReview", () => {
      test("should report review successfully", async () => {
         const reportData = {
            reviewId: "review-123",
            reporterId: "user-123",
            reason: "spam" as const,
            description: "This looks like spam content"
         };
         const mockReport = {
            id: "report-123",
            ...reportData,
            status: "pending" as status,
            reviewedBy: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockReport]);

         const result = await reviewService.reportReview(reportData);

         expect(result).toEqual(mockReport);
         expect(mockDb.insert).toHaveBeenCalled();
         expect(mockDb.values).toHaveBeenCalledWith(reportData);
      });

      test("should report review without description", async () => {
         const reportData = {
            reviewId: "review-123",
            reporterId: "user-123",
            reason: "inappropriate" as const,
            description: ''
         };
         const mockReport = {
            id: "report-123",
            ...reportData,
            status: "pending" as status,
            reviewedBy: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockReport]);

         const result = await reviewService.reportReview(reportData);

         expect(result).toEqual(mockReport);
      });
   });

   describe("getCustomerReviews", () => {
      test("should get customer reviews", async () => {
         const customerId = "customer-123";
         const mockReviews = [
            {
               id: "review-1",
               orderId: "order-1",
               customerId,
               restaurantId: "restaurant-1",
               driverId: "driver-1",
               restaurantRating: 4,
               driverRating: 5,
               foodQuality: 4,
               deliveryTime: 3,
               restaurantComment: "Great!",
               driverComment: "Fast!",
               isVerified: true,
               isVisible: true,
               createdAt: new Date(),
               updatedAt: new Date()
            },
            {
               id: "review-2",
               orderId: "order-2",
               customerId,
               restaurantId: "restaurant-2",
               driverId: "driver-2",
               restaurantRating: 5,
               driverRating: 4,
               foodQuality: 5,
               deliveryTime: 4,
               restaurantComment: "Excellent!",
               driverComment: "Good!",
               isVerified: true,
               isVisible: true,
               createdAt: new Date(),
               updatedAt: new Date()
            }
         ];

         mockDb.returning.mockResolvedValue(mockReviews);

         const result = await reviewService.getCustomerReviews(customerId);

         expect(result).toEqual(mockReviews);
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.orderBy).toHaveBeenCalled();
      });
   });

   describe("getDriverReviews", () => {
      test("should get driver reviews", async () => {
         const driverId = "driver-123";
         const mockReviews = [
            {
               id: "review-1",
               orderId: "order-1",
               customerId: "customer-1",
               driverRating: 5,
               deliveryTime: 4,
               driverComment: "Great service!",
               createdAt: new Date()
            }
         ];

         mockDb.returning.mockResolvedValue(mockReviews);

         const result = await reviewService.getDriverReviews(driverId);

         expect(result).toEqual(mockReviews);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe("getDriverStats", () => {
      test("should get driver statistics", async () => {
         const driverId = "driver-123";
         const mockStats = {
            totalReviews: 50,
            averageRating: 4.5,
            averageDeliveryTime: 4.2
         };

         mockDb.returning.mockResolvedValue([mockStats]);

         const result = await reviewService.getDriverStats(driverId);

         expect(result).toEqual(mockStats);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe("getReportedReviews", () => {
      test("should get all reported reviews when no status provided", async () => {
         const mockReports = [
            {
               report: {
                  id: "report-1",
                  reviewId: "review-1",
                  reporterId: "reporter-1",
                  reason: "spam" as const,
                  description: "This is spam",
                  status: "pending" as status,
                  reviewedBy: null,
                  createdAt: new Date(),
                  updatedAt: new Date()
               },
               review: {
                  id: "review-1",
                  orderId: "order-1",
                  customerId: "customer-1",
                  restaurantId: "restaurant-1",
                  driverId: "driver-1",
                  restaurantRating: 4,
                  driverRating: 5,
                  foodQuality: 4,
                  deliveryTime: 3,
                  restaurantComment: "Test review",
                  driverComment: "Good",
                  isVerified: true,
                  isVisible: true,
                  createdAt: new Date(),
                  updatedAt: new Date()
               }
            }
         ];

         mockDb.returning.mockResolvedValue(mockReports);

         const result = await reviewService.getReportedReviews();

         expect(result).toEqual(mockReports);
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.innerJoin).toHaveBeenCalled();
      });

      test("should filter reported reviews by status", async () => {
         const status = "pending";
         const mockReports = [
            {
               report: {
                  id: "report-1",
                  reviewId: "review-1",
                  reporterId: "reporter-1",
                  reason: "spam" as const,
                  description: "This is spam",
                  status: "pending" as status,
                  reviewedBy: null,
                  createdAt: new Date(),
                  updatedAt: new Date()
               },
               review: {
                  id: "review-1",
                  orderId: "order-1",
                  customerId: "customer-1",
                  restaurantId: "restaurant-1",
                  driverId: "driver-1",
                  restaurantRating: 4,
                  driverRating: 5,
                  foodQuality: 4,
                  deliveryTime: 3,
                  restaurantComment: "Test review",
                  driverComment: "Good",
                  isVerified: true,
                  isVisible: true,
                  createdAt: new Date(),
                  updatedAt: new Date()
               }
            }
         ];

         mockDb.returning.mockResolvedValue(mockReports);

         const result = await reviewService.getReportedReviews(status);

         expect(result).toEqual(mockReports);
         expect(mockDb.where).toHaveBeenCalled();
      });
   });

   describe("resolverReviewReport", () => {
      test("should resolve review report and hide review", async () => {
         const reportId = "report-123";
         const adminId = "admin-123";
         const action = "resolve";
         const mockUpdatedReport = {
            id: reportId,
            reviewId: "review-123",
            status: "resolved" as status,
            reviewedBy: adminId,
            reporterId: "user-123",
            reason: "inappropriate" as const,
            description: "This looks inappropriate",
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockUpdatedReport]);

         const result = await reviewService.resolverReviewReport(reportId, adminId, action);

         expect(result).toEqual(mockUpdatedReport);
         expect(mockDb.update).toHaveBeenCalledTimes(2); // report update + review visibility update
         expect(mockDb.set).toHaveBeenCalledTimes(2);
      });

      test("should reject review report without hiding review", async () => {
         const reportId = "report-123";
         const adminId = "admin-123";
         const action = "reject";
         const mockUpdatedReport = {
            id: reportId,
            reviewId: "review-123",
            status: "rejected" as status,
            reviewedBy: adminId,
            reporterId: "user-123",
            reason: "inappropriate" as const,
            description: "This looks inappropriate",
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning.mockResolvedValue([mockUpdatedReport]);

         const result = await reviewService.resolverReviewReport(reportId, adminId, action);

         expect(result).toEqual(mockUpdatedReport);
         expect(mockDb.update).toHaveBeenCalledTimes(1); // only report update, no review visibility change
      });
   });

   describe("Private Methods Validation", () => {
      test("validateRating should accept valid ratings", async () => {
         const validData = {
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            restaurantRating: 1,
            foodQuality: 5,
            deliveryTime: 3
         };

         const mockReview = {
            id: "review-123",
            ...validData,
            driverId: null,
            driverRating: null,
            restaurantComment: null,
            driverComment: null,
            isVerified: true,
            isVisible: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.returning
            .mockResolvedValueOnce([]) // No existing review
            .mockResolvedValueOnce([mockReview]);

         const result = await reviewService.createReview(validData);
         expect(result).toBeDefined();
      });

      test("validateRating should reject non-integer ratings", async () => {
         const invalidData = {
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            restaurantRating: 3.5,
            foodQuality: 4,
            deliveryTime: 3
         };

         await expect(reviewService.createReview(invalidData)).rejects.toThrow(
            "restaurant rating must be an integer between 1 and 5"
         );
      });
   });

   describe("Mock Chaining Examples", () => {
      test("should demonstrate complex database operations", async () => {
         const restaurantId = "restaurant-123";

         // Setup mock responses in order
         mockDb.returning
            .mockResolvedValueOnce([]) // createReview check
            .mockResolvedValueOnce([{
               id: "review-123",
               orderId: "order-123",
               customerId: "customer-123",
               restaurantId,
               restaurantRating: 4,
               foodQuality: 4,
               deliveryTime: 3,
               driverId: null,
               driverRating: null,
               restaurantComment: null,
               driverComment: null,
               isVerified: true,
               isVisible: true,
               createdAt: new Date(),
               updatedAt: new Date()
            }]) // createReview insert
            .mockResolvedValueOnce([{
               totalReviews: 1,
               averageRating: 4.0,
               averageFoodQuality: 4.0,
               averageDeliveryTime: 3.0,
               fiveStars: 0,
               fourStars: 1,
               threeStars: 0,
               twoStars: 0,
               oneStar: 0
            }]); // getRestaurantStats

         const reviewData = {
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId,
            restaurantRating: 4,
            foodQuality: 4,
            deliveryTime: 3
         };

         const review = await reviewService.createReview(reviewData);
         expect(review.id).toBe("review-123");

         const stats = await reviewService.getRestaurantStats(restaurantId);
         expect(stats.totalReviews).toBe(1);
         expect(stats.averageRating).toBe(4.0);
      });

      test("should handle mixed success/error scenarios", async () => {
         mockDb.returning
            .mockResolvedValueOnce([]) // First attempt: no existing review
            .mockRejectedValueOnce(new Error("Database error")) // First attempt: insert fails
            .mockResolvedValueOnce([]) // Second attempt: no existing review
            .mockResolvedValueOnce([{
               id: "review-456",
               orderId: "order-456",
               customerId: "customer-123",
               restaurantId: "restaurant-123",
               restaurantRating: 5,
               foodQuality: 5,
               deliveryTime: 5,
               driverId: null,
               driverRating: null,
               restaurantComment: null,
               driverComment: null,
               isVerified: true,
               isVisible: true,
               createdAt: new Date(),
               updatedAt: new Date()
            }]); // Second attempt: success

         const reviewData = {
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            restaurantRating: 5,
            foodQuality: 5,
            deliveryTime: 5
         };

         await expect(reviewService.createReview(reviewData)).rejects.toThrow("Database error");

         const secondReviewData = { ...reviewData, orderId: "order-456" };
         const result = await reviewService.createReview(secondReviewData);
         expect(result.id).toBe("review-456");
      });
   });
});