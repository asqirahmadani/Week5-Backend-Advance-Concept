import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";

// Mock the DeliveryService dengan signature yang benar
const mockDeliveryService = {
   getDriverDeliveries: mock().mockResolvedValue([]),
   assignDriver: mock().mockResolvedValue({ id: "test-delivery-id" }),
   acceptDelivery: mock().mockResolvedValue({ id: "test-delivery-id", status: "accepted" }),
   updateDeliveryStatus: mock().mockResolvedValue({ id: "test-delivery-id", status: "delivered" }),
   getDeliveryByOrderId: mock().mockResolvedValue({ id: "test-delivery-id" }),
   getDeliveryTracking: mock().mockResolvedValue([]),
   cancelDelivery: mock().mockResolvedValue({ id: "test-delivery-id", status: "cancelled" }),
   updateDriverLocation: mock().mockResolvedValue({ driverId: "test-driver-id" })
};

// Mock database
const mockDb = {};

// Create mock headers for authentication
const createMockHeaders = (userId: string = "test-user-id", role: string = "driver", email: string = "test@example.com") => ({
   "x-user-id": userId,
   "x-user-role": role,
   "x-user-email": email
});

describe("Delivery Routes", () => {
   let protectedApp: any;
   let publicApp: any;

   beforeEach(() => {
      // Reset all mocks
      Object.values(mockDeliveryService).forEach(mockFn => {
         mockFn.mockClear();
      });

      // Create protected routes app
      protectedApp = new Elysia()
         .derive(() => ({
            db: mockDb,
            deliveryService: mockDeliveryService
         }))
         .derive(({ headers, set }: any) => {
            const userId = headers?.["x-user-id"];
            const userRole = headers?.["x-user-role"];
            const userEmail = headers?.["x-user-email"];

            if (!userId) {
               set.status = 401;
               throw new Error("Missing user authentication from gateway");
            }

            return {
               user: {
                  sub: userId,
                  role: userRole,
                  email: userEmail
               },
               userId,
               userRole,
               userEmail
            };
         })
         // Protected routes
         .get("/my-deliveries", async ({ user, deliveryService, set }) => {
            if (user.role !== "driver") {
               set.status = 403;
               return { success: false, error: "Only driver can view their deliveries" };
            }

            const deliveries = await deliveryService.getDriverDeliveries(user.sub);
            return {
               success: true,
               data: deliveries
            };
         })
         .post("/assign-driver", async ({ body, user, set, deliveryService }: any) => {
            try {
               const assignment = await deliveryService.assignDriver(body, user.sub);
               return {
                  success: true,
                  data: assignment
               };
            } catch (error) {
               set.status = 400;
               return {
                  success: false,
                  error: error instanceof Error ? error.message : "Assignment failed"
               };
            }
         })
         .post("/:deliveryId/accept", async ({ params, user, set, deliveryService }) => {
            try {
               if (user.role !== "driver") {
                  set.status = 403;
                  return { success: false, error: "Only drivers can accept deliveries" };
               }

               const delivery = await deliveryService.acceptDelivery(params.deliveryId, user.sub);
               return {
                  success: true,
                  data: delivery
               };
            } catch (error) {
               set.status = 400;
               return {
                  success: false,
                  error: error instanceof Error ? error.message : "Failed to accept delivery"
               };
            }
         })
         .patch("/:deliveryId/status", async ({ params, body, user, set, deliveryService }: any) => {
            try {
               if (user.role !== "driver") {
                  set.status = 403;
                  return { success: false, error: "Only driver can update delivery status" };
               }

               const delivery = await deliveryService.updateDeliveryStatus(
                  params.deliveryId,
                  user.sub,
                  body.status,
                  body.location
               );

               return {
                  success: true,
                  data: delivery
               };
            } catch (error) {
               set.status = 400;
               return {
                  success: false,
                  error: error instanceof Error ? error.message : "Failed to update status"
               };
            }
         });

      // Create public routes app (tanpa authentication middleware)
      publicApp = new Elysia()
         .derive(() => ({
            deliveryService: mockDeliveryService
         }))
         .get("/order/:orderId", async ({ params, deliveryService }) => {
            const delivery = await deliveryService.getDeliveryByOrderId(params.orderId);
            return {
               success: true,
               data: delivery
            };
         })
         .get("/:deliveryId/tracking", async ({ params, deliveryService }) => {
            const tracking = await deliveryService.getDeliveryTracking(params.deliveryId);
            return {
               success: true,
               data: tracking
            };
         })
         .post("/assign", async ({ body, set, deliveryService }: any) => {
            try {
               const assignment = await deliveryService.assignDriver(body);
               return {
                  success: true,
                  data: assignment
               };
            } catch (error) {
               set.status = 400;
               return {
                  success: false,
                  error: error instanceof Error ? error.message : "Assignment failed"
               };
            }
         })
         .patch("/:deliveryId/cancel", async ({ params, set, deliveryService }) => {
            try {
               const delivery = await deliveryService.cancelDelivery(params.deliveryId);
               return {
                  success: true,
                  data: delivery
               };
            } catch (error) {
               set.status = 400;
               return {
                  success: false,
                  error: error instanceof Error ? error.message : "Failed to cancel delivery"
               };
            }
         });
   });

   describe("Protected Routes", () => {
      test("GET /my-deliveries - should return driver deliveries", async () => {
         const mockDeliveries = [
            { id: "delivery-1", orderId: "order-1", status: "accepted" },
            { id: "delivery-2", orderId: "order-2", status: "picked_up" }
         ];

         mockDeliveryService.getDriverDeliveries.mockResolvedValueOnce(mockDeliveries);

         const response = await protectedApp.handle(
            new Request("http://localhost/my-deliveries", {
               method: "GET",
               headers: createMockHeaders()
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockDeliveries
         });
         expect(mockDeliveryService.getDriverDeliveries).toHaveBeenCalledWith("test-user-id");
      });

      test("GET /my-deliveries - should reject non-driver users", async () => {
         const response = await protectedApp.handle(
            new Request("http://localhost/my-deliveries", {
               method: "GET",
               headers: createMockHeaders("test-user-id", "customer")
            })
         );

         expect(response.status).toBe(403);
         const data = await response.json();
         expect(data).toEqual({
            success: false,
            error: "Only driver can view their deliveries"
         });
         expect(mockDeliveryService.getDriverDeliveries).not.toHaveBeenCalled();
      });

      test("POST /assign-driver - should assign driver successfully", async () => {
         const mockAssignment = { id: "new-delivery-id", orderId: "order-123" };
         const requestBody = {
            orderId: "order-123",
            customerId: "customer-123",
            restaurantId: "restaurant-123",
            deliveryAddress: "123 Main St"
         };

         mockDeliveryService.assignDriver.mockResolvedValueOnce(mockAssignment);

         const response = await protectedApp.handle(
            new Request("http://localhost/assign-driver", {
               method: "POST",
               headers: {
                  "Content-Type": "application/json",
                  ...createMockHeaders()
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockAssignment
         });
         expect(mockDeliveryService.assignDriver).toHaveBeenCalledWith(requestBody, "test-user-id");
      });

      test("POST /:deliveryId/accept - should accept delivery successfully", async () => {
         const mockDelivery = { id: "delivery-123", status: "accepted" };
         mockDeliveryService.acceptDelivery.mockResolvedValueOnce(mockDelivery);

         const response = await protectedApp.handle(
            new Request("http://localhost/delivery-123/accept", {
               method: "POST",
               headers: createMockHeaders()
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockDelivery
         });
         expect(mockDeliveryService.acceptDelivery).toHaveBeenCalledWith("delivery-123", "test-user-id");
      });

      test("POST /:deliveryId/accept - should reject non-driver users", async () => {
         const response = await protectedApp.handle(
            new Request("http://localhost/delivery-123/accept", {
               method: "POST",
               headers: createMockHeaders("test-user-id", "customer")
            })
         );

         expect(response.status).toBe(403);
         const data = await response.json();
         expect(data).toEqual({
            success: false,
            error: "Only drivers can accept deliveries"
         });
         expect(mockDeliveryService.acceptDelivery).not.toHaveBeenCalled();
      });

      test("PATCH /:deliveryId/status - should update delivery status", async () => {
         const mockUpdatedDelivery = { id: "delivery-123", status: "delivered" };
         const requestBody = {
            status: "delivered",
            location: { latitude: 40.7128, longitude: -74.0060 }
         };

         mockDeliveryService.updateDeliveryStatus.mockResolvedValueOnce(mockUpdatedDelivery);

         const response = await protectedApp.handle(
            new Request("http://localhost/delivery-123/status", {
               method: "PATCH",
               headers: {
                  "Content-Type": "application/json",
                  ...createMockHeaders()
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockUpdatedDelivery
         });
         expect(mockDeliveryService.updateDeliveryStatus).toHaveBeenCalledWith(
            "delivery-123",
            "test-user-id",
            "delivered",
            { latitude: 40.7128, longitude: -74.0060 }
         );
      });

      test("should handle missing authentication", async () => {
         const response = await protectedApp.handle(
            new Request("http://localhost/my-deliveries", {
               method: "GET"
            })
         );

         expect(response.status).toBe(401);
      });
   });

   describe("Public Routes", () => {
      test("GET /order/:orderId - should get delivery by order id", async () => {
         const mockDelivery = { id: "delivery-123", orderId: "order-123" };
         mockDeliveryService.getDeliveryByOrderId.mockResolvedValueOnce(mockDelivery);

         const response = await publicApp.handle(
            new Request("http://localhost/order/order-123", {
               method: "GET"
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockDelivery
         });
         expect(mockDeliveryService.getDeliveryByOrderId).toHaveBeenCalledWith("order-123");
      });

      test("GET /:deliveryId/tracking - should get delivery tracking", async () => {
         const mockTracking = [
            { id: "track-1", deliveryId: "delivery-123", status: "picked_up" },
            { id: "track-2", deliveryId: "delivery-123", status: "delivered" }
         ];
         mockDeliveryService.getDeliveryTracking.mockResolvedValueOnce(mockTracking);

         const response = await publicApp.handle(
            new Request("http://localhost/delivery-123/tracking", {
               method: "GET"
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockTracking
         });
         expect(mockDeliveryService.getDeliveryTracking).toHaveBeenCalledWith("delivery-123");
      });

      test("POST /assign - should assign driver (public)", async () => {
         const mockAssignment = { id: "new-delivery-id", orderId: "order-456" };
         const requestBody = {
            orderId: "order-456",
            customerId: "customer-456",
            restaurantId: "restaurant-456",
            deliveryAddress: "456 Oak Ave"
         };

         mockDeliveryService.assignDriver.mockResolvedValueOnce(mockAssignment);

         const response = await publicApp.handle(
            new Request("http://localhost/assign", {
               method: "POST",
               headers: {
                  "Content-Type": "application/json"
               },
               body: JSON.stringify(requestBody)
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockAssignment
         });
         expect(mockDeliveryService.assignDriver).toHaveBeenCalledWith(requestBody);
      });

      test("PATCH /:deliveryId/cancel - should cancel delivery", async () => {
         const mockCancelledDelivery = { id: "delivery-123", status: "cancelled" };
         mockDeliveryService.cancelDelivery.mockResolvedValueOnce(mockCancelledDelivery);

         const response = await publicApp.handle(
            new Request("http://localhost/delivery-123/cancel", {
               method: "PATCH"
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data).toEqual({
            success: true,
            data: mockCancelledDelivery
         });
         expect(mockDeliveryService.cancelDelivery).toHaveBeenCalledWith("delivery-123");
      });
   });

   describe("Error Handling", () => {
      test("should handle service errors in assignment", async () => {
         const errorMessage = "No available drivers found";
         mockDeliveryService.assignDriver.mockRejectedValueOnce(new Error(errorMessage));

         const response = await publicApp.handle(
            new Request("http://localhost/assign", {
               method: "POST",
               headers: {
                  "Content-Type": "application/json"
               },
               body: JSON.stringify({
                  orderId: "order-123",
                  customerId: "customer-123",
                  restaurantId: "restaurant-123",
                  deliveryAddress: "123 Main St"
               })
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data).toEqual({
            success: false,
            error: errorMessage
         });
      });

      test("should handle service errors in delivery acceptance", async () => {
         const errorMessage = "Delivery assignment not found";
         mockDeliveryService.acceptDelivery.mockRejectedValueOnce(new Error(errorMessage));

         const response = await protectedApp.handle(
            new Request("http://localhost/delivery-123/accept", {
               method: "POST",
               headers: createMockHeaders()
            })
         );

         expect(response.status).toBe(400);
         const data = await response.json();
         expect(data).toEqual({
            success: false,
            error: errorMessage
         });
      });
   });
});

describe("Location Routes", () => {
   let locationApp: any;

   beforeEach(() => {
      // Reset all mocks
      Object.values(mockDeliveryService).forEach(mockFn => {
         mockFn.mockClear();
      });

      // Create location routes app
      locationApp = new Elysia()
         .derive(() => ({
            db: mockDb,
            deliveryService: mockDeliveryService
         }))
         .derive(({ headers, set }: any) => {
            const userId = headers?.["x-user-id"];
            const userRole = headers?.["x-user-role"];
            const userEmail = headers?.["x-user-email"];

            if (!userId) {
               set.status = 401;
               throw new Error("Missing user authentication from gateway");
            }

            return {
               user: {
                  sub: userId,
                  role: userRole,
                  email: userEmail
               },
               userId,
               userRole,
               userEmail
            };
         })
         .post("/update", async ({ body, user, set, deliveryService }: any) => {
            try {
               if (user.role !== "driver") {
                  set.status = 403;
                  return { success: false, error: "Only drivers can update location" };
               }

               const location = await deliveryService.updateDriverLocation(
                  body.userId,
                  body.latitude,
                  body.longitude,
                  body.isOnline
               );

               return {
                  success: true,
                  data: location
               };
            } catch (error) {
               set.status = 400;
               return {
                  success: false,
                  error: error instanceof Error ? error.message : "Failed to update location"
               };
            }
         });
   });

   test("POST /update - should update driver location successfully", async () => {
      const mockLocationUpdate = {
         driverId: "driver-123",
         latitude: "40.7128",
         longitude: "-74.0060",
         isOnline: true
      };
      const requestBody = {
         userId: "driver-123",
         latitude: 40.7128,
         longitude: -74.0060,
         isOnline: true
      };

      mockDeliveryService.updateDriverLocation.mockResolvedValueOnce(mockLocationUpdate);

      const response = await locationApp.handle(
         new Request("http://localhost/update", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               ...createMockHeaders()
            },
            body: JSON.stringify(requestBody)
         })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
         success: true,
         data: mockLocationUpdate
      });
      expect(mockDeliveryService.updateDriverLocation).toHaveBeenCalledWith(
         "driver-123",
         40.7128,
         -74.0060,
         true
      );
   });

   test("POST /update - should update location with default isOnline", async () => {
      const mockLocationUpdate = {
         driverId: "driver-123",
         latitude: "40.7128",
         longitude: "-74.0060"
      };
      const requestBody = {
         userId: "driver-123",
         latitude: 40.7128,
         longitude: -74.0060
      };

      mockDeliveryService.updateDriverLocation.mockResolvedValueOnce(mockLocationUpdate);

      const response = await locationApp.handle(
         new Request("http://localhost/update", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               ...createMockHeaders()
            },
            body: JSON.stringify(requestBody)
         })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
         success: true,
         data: mockLocationUpdate
      });
      expect(mockDeliveryService.updateDriverLocation).toHaveBeenCalledWith(
         "driver-123",
         40.7128,
         -74.0060,
         undefined
      );
   });

   test("POST /update - should reject non-driver users", async () => {
      const requestBody = {
         userId: "customer-123",
         latitude: 40.7128,
         longitude: -74.0060,
         isOnline: true
      };

      const response = await locationApp.handle(
         new Request("http://localhost/update", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               ...createMockHeaders("customer-123", "customer")
            },
            body: JSON.stringify(requestBody)
         })
      );

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data).toEqual({
         success: false,
         error: "Only drivers can update location"
      });
      expect(mockDeliveryService.updateDriverLocation).not.toHaveBeenCalled();
   });

   test("POST /update - should handle missing authentication", async () => {
      const requestBody = {
         userId: "driver-123",
         latitude: 40.7128,
         longitude: -74.0060,
         isOnline: true
      };

      const response = await locationApp.handle(
         new Request("http://localhost/update", {
            method: "POST",
            headers: {
               "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
         })
      );

      expect(response.status).toBe(401);
      expect(mockDeliveryService.updateDriverLocation).not.toHaveBeenCalled();
   });

   test("POST /update - should handle service errors", async () => {
      const errorMessage = "Failed to update driver location";
      const requestBody = {
         userId: "driver-123",
         latitude: 40.7128,
         longitude: -74.0060,
         isOnline: true
      };

      mockDeliveryService.updateDriverLocation.mockRejectedValueOnce(new Error(errorMessage));

      const response = await locationApp.handle(
         new Request("http://localhost/update", {
            method: "POST",
            headers: {
               "Content-Type": "application/json",
               ...createMockHeaders()
            },
            body: JSON.stringify(requestBody)
         })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toEqual({
         success: false,
         error: errorMessage
      });
   });
});

describe("Mock Chaining Examples", () => {
   test("should demonstrate complex mock chaining", async () => {
      // Reset mocks before this test
      mockDeliveryService.getDriverDeliveries.mockClear();
      mockDeliveryService.getDeliveryTracking.mockClear();

      const app = new Elysia()
         .derive(() => ({
            deliveryService: mockDeliveryService
         }))
         .get("/complex", async ({ deliveryService }) => {
            const deliveries = await deliveryService.getDriverDeliveries("driver-1");
            const tracking = await deliveryService.getDeliveryTracking(deliveries[0]?.id);
            return { deliveries, tracking };
         });

      // Setup proper mock chain for first call
      mockDeliveryService.getDriverDeliveries.mockResolvedValueOnce([{ id: "delivery-1" }]);
      mockDeliveryService.getDeliveryTracking.mockResolvedValueOnce([{ id: "track-1", status: "picked_up" }]);

      // First call
      const response1 = await app.handle(
         new Request("http://localhost/complex")
      );
      const data1 = await response1.json();
      expect(data1.deliveries).toEqual([{ id: "delivery-1" }]);
      expect(data1.tracking).toEqual([{ id: "track-1", status: "picked_up" }]);

      // Setup mock chain for second call
      mockDeliveryService.getDriverDeliveries.mockResolvedValueOnce([{ id: "delivery-2" }]);
      mockDeliveryService.getDeliveryTracking.mockResolvedValueOnce([{ id: "track-2", status: "delivered" }]);

      // Second call with different mock return
      const response2 = await app.handle(
         new Request("http://localhost/complex")
      );
      const data2 = await response2.json();
      expect(data2.deliveries).toEqual([{ id: "delivery-2" }]);
      expect(data2.tracking).toEqual([{ id: "track-2", status: "delivered" }]);
   });

   test("should demonstrate conditional mock behavior", async () => {
      // Reset mocks
      mockDeliveryService.getDeliveryByOrderId.mockClear();
      mockDeliveryService.getDriverDeliveries.mockClear();

      const app = new Elysia()
         .derive(() => ({ deliveryService: mockDeliveryService }))
         .get("/conditional/:id", async ({ params, deliveryService }) => {
            if (params.id === "error") {
               return await deliveryService.getDeliveryByOrderId(params.id);
            }
            return await deliveryService.getDriverDeliveries(params.id);
         });

      // Setup conditional mocks
      mockDeliveryService.getDeliveryByOrderId.mockRejectedValueOnce(new Error("Order not found"));
      mockDeliveryService.getDriverDeliveries.mockResolvedValueOnce([{ id: "success-delivery" }]);

      // Test error case
      try {
         await app.handle(new Request("http://localhost/conditional/error"));
      } catch (error) {
         expect(error).toBeInstanceOf(Error);
      }

      // Test success case
      const successResponse = await app.handle(
         new Request("http://localhost/conditional/driver-123")
      );
      const successData = await successResponse.json();
      expect(successData).toEqual([{ id: "success-delivery" }]);

      // Verify mock call counts
      expect(mockDeliveryService.getDeliveryByOrderId).toHaveBeenCalledTimes(1);
      expect(mockDeliveryService.getDriverDeliveries).toHaveBeenCalledTimes(1);
   });

   test("should demonstrate mock chaining with different scenarios", async () => {
      // Reset mocks
      mockDeliveryService.assignDriver.mockClear();

      const app = new Elysia()
         .derive(() => ({ deliveryService: mockDeliveryService }))
         .post("/test-chain", async ({ deliveryService }) => {
            return await deliveryService.assignDriver({ orderId: "test" });
         });

      // Chain multiple scenarios
      mockDeliveryService.assignDriver
         .mockResolvedValueOnce({ id: "delivery-1", status: "assigned" })
         .mockRejectedValueOnce(new Error("No drivers available"))
         .mockResolvedValueOnce({ id: "delivery-3", status: "assigned" });

      // Test first call - success
      const response1 = await app.handle(
         new Request("http://localhost/test-chain", { method: "POST" })
      );
      const data1 = await response1.json();
      expect(data1).toEqual({ id: "delivery-1", status: "assigned" });

      // Test second call - error (will throw)
      try {
         await app.handle(
            new Request("http://localhost/test-chain", { method: "POST" })
         );
      } catch (error) {
         expect(error).toBeInstanceOf(Error);
      }

      // Test third call - success again
      const response3 = await app.handle(
         new Request("http://localhost/test-chain", { method: "POST" })
      );
      const data3 = await response3.json();
      expect(data3).toEqual({ id: "delivery-3", status: "assigned" });

      // Verify call count
      expect(mockDeliveryService.assignDriver).toHaveBeenCalledTimes(3);
   });
});