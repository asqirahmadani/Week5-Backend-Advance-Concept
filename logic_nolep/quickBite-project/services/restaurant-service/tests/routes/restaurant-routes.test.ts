import { restaurantRoutes } from "../../src/routes/restaurant.route";
import { describe, it, expect, beforeEach, mock } from "bun:test";
import { Elysia } from "elysia";

describe('Restaurant Routes', () => {
   let mockRestaurantService: any;

   beforeEach(() => {
      // Mock restaurant service with all methods
      mockRestaurantService = {
         getAllRestaurants: mock(),
         getRestaurantCount: mock(),
         getRestaurantById: mock(),
         createRestaurant: mock(),
         updateRestaurant: mock(),
         updateRestaurantRating: mock(),
         deleteRestaurant: mock(),
         getRestaurantMenu: mock(),
         getOwnerRestaurants: mock()
      };
   });

   // Helper function to create app with mocked service for public routes
   const createPublicApp = () => {
      return new Elysia()
         .derive(() => ({
            db: {}, // Mock db
            restaurantService: mockRestaurantService // Inject mock service
         }))
         .use(restaurantRoutes);
   };

   // Helper function to create app with mocked service for protected routes
   const createProtectedApp = () => {
      return new Elysia()
         .derive(() => ({
            db: {}, // Mock db
            restaurantService: mockRestaurantService // Inject mock service
         }))
         .use(restaurantRoutes);
   };

   describe('Public Routes', () => {
      describe('GET /', () => {
         it('should get all restaurants successfully', async () => {
            const mockRestaurants = [
               {
                  id: 'restaurant-1',
                  name: 'Restaurant One',
                  cuisineType: 'Italian',
                  city: 'Jakarta'
               }
            ];

            mockRestaurantService.getAllRestaurants.mockResolvedValue(mockRestaurants);
            mockRestaurantService.getRestaurantCount.mockResolvedValue(1);

            const app = createPublicApp();
            const response = await app.handle(new Request('http://localhost/api/restaurant'));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.restaurants).toEqual(mockRestaurants);
            expect(data.data.pagination.total).toBe(1);
         });

         it('should get restaurants with filters', async () => {
            const mockRestaurants = [
               {
                  id: 'restaurant-1',
                  name: 'Italian Restaurant',
                  cuisineType: 'Italian',
                  city: 'Jakarta'
               }
            ];

            mockRestaurantService.getAllRestaurants.mockResolvedValue(mockRestaurants);
            mockRestaurantService.getRestaurantCount.mockResolvedValue(1);

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant?city=Jakarta&cuisine=Italian&page=1&limit=5')
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(mockRestaurantService.getAllRestaurants).toHaveBeenCalledWith(
               1, 5, { city: 'Jakarta', cuisine: 'Italian', isActive: true }
            );
            expect(mockRestaurantService.getRestaurantCount).toHaveBeenCalledWith(
               { city: 'Jakarta', cuisine: 'Italian', isActive: true }
            );
         });

         it('should handle error when getting restaurants', async () => {
            mockRestaurantService.getAllRestaurants.mockRejectedValue(new Error('Database error'));
            mockRestaurantService.getRestaurantCount.mockResolvedValue(0);

            const app = createPublicApp();
            const response = await app.handle(new Request('http://localhost/api/restaurant'));
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Database error');
         });
      });

      describe('GET /:id', () => {
         it('should get restaurant by ID successfully', async () => {
            const mockRestaurant = {
               id: 'restaurant-1',
               name: 'Test Restaurant',
               cuisineType: 'Italian'
            };

            mockRestaurantService.getRestaurantById.mockResolvedValue(mockRestaurant);

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1')
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.restaurant).toEqual(mockRestaurant);
            expect(mockRestaurantService.getRestaurantById).toHaveBeenCalledWith('restaurant-1');
         });

         it('should return 404 when restaurant not found', async () => {
            mockRestaurantService.getRestaurantById.mockRejectedValue(new Error('Restaurant not found'));

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/nonexistent')
            );
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Restaurant not found');
         });
      });

      describe('PATCH /:restaurantId/rating', () => {
         it('should update restaurant rating successfully', async () => {
            const ratingData = {
               newRating: 5,
               reviewId: 'review-1'
            };

            const mockResult = {
               restaurantId: 'restaurant-1',
               previousRating: 4.0,
               newAverageRating: 4.2,
               totalReviews: 11,
               reviewId: 'review-1'
            };

            mockRestaurantService.updateRestaurantRating.mockResolvedValue(mockResult);

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1/rating', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(ratingData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Restaurant rating updated successfully');
            expect(data.data).toEqual(mockResult);
            expect(mockRestaurantService.updateRestaurantRating).toHaveBeenCalledWith(
               'restaurant-1',
               5,
               'review-1'
            );
         });

         it('should handle invalid rating value', async () => {
            const invalidRatingData = {
               newRating: 6, // Invalid: should be 1-5
               reviewId: 'review-1'
            };

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1/rating', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(invalidRatingData)
               })
            );

            expect(response.status).toBe(422); // Validation error
         });
      });

      describe('GET /:id/menu', () => {
         it('should get restaurant menu successfully', async () => {
            const mockMenu = {
               restaurant: 'Test Restaurant',
               menu: [
                  {
                     id: 'category-1',
                     category: 'Main Course',
                     menus: [
                        {
                           id: 'item-1',
                           name: 'Pasta',
                           price: '15.00'
                        }
                     ]
                  }
               ]
            };

            mockRestaurantService.getRestaurantMenu.mockResolvedValue(mockMenu);

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1/menu')
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Get restaurant menu successfully');
            expect(data.data).toEqual(mockMenu);
            expect(mockRestaurantService.getRestaurantMenu).toHaveBeenCalledWith('restaurant-1');
         });

         it('should return 404 when restaurant not found', async () => {
            mockRestaurantService.getRestaurantMenu.mockRejectedValue(new Error('Restaurant not found'));

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/nonexistent/menu')
            );
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Restaurant not found');
         });
      });
   });

   describe('Protected Routes', () => {
      describe('POST /', () => {
         it('should create restaurant successfully', async () => {
            const restaurantData = {
               name: 'New Restaurant',
               description: 'Great food',
               cuisineType: 'Italian',
               address: '123 Main St',
               city: 'Jakarta',
               phone: '+62123456789',
               email: 'test@restaurant.com',
               deliveryFee: 5000,
               minimumOrder: 15000,
               estimatedPrepTime: 30
            };

            const mockCreatedRestaurant = {
               id: 'restaurant-1',
               ownerId: 'user-1',
               ...restaurantData
            };

            mockRestaurantService.createRestaurant.mockResolvedValue(mockCreatedRestaurant);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  },
                  body: JSON.stringify(restaurantData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Restaurant created successfully');
            expect(data.data.restaurant).toEqual(mockCreatedRestaurant);
            expect(mockRestaurantService.createRestaurant).toHaveBeenCalledWith({
               ownerId: 'user-1',
               ...restaurantData
            });
         });

         it('should handle validation error when creating restaurant', async () => {
            const invalidData = {
               name: 'New Restaurant'
               // Missing required fields
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422); // Validation error
         });

         it('should return 401 when missing authentication headers', async () => {
            const restaurantData = {
               name: 'New Restaurant',
               cuisineType: 'Italian',
               address: '123 Main St',
               city: 'Jakarta',
               phone: '+62123456789',
               email: 'test@restaurant.com',
               deliveryFee: 5000,
               minimumOrder: 15000,
               estimatedPrepTime: 30
            };

            const app = createProtectedApp(); // No headers provided
            const response = await app.handle(
               new Request('http://localhost/api/restaurant', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(restaurantData)
               })
            );

            expect(response.status).toBe(401);
         });
      });

      describe('PUT /:id', () => {
         it('should update restaurant successfully', async () => {
            const updateData = {
               name: 'Updated Restaurant',
               description: 'Updated description'
            };

            const mockUpdatedRestaurant = {
               id: 'restaurant-1',
               ownerId: 'user-1',
               ...updateData
            };

            mockRestaurantService.updateRestaurant.mockResolvedValue(mockUpdatedRestaurant);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1', {
                  method: 'PUT',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  },
                  body: JSON.stringify(updateData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Restaurant updated successfully');
            expect(mockRestaurantService.updateRestaurant).toHaveBeenCalledWith(
               'restaurant-1',
               updateData,
               { sub: 'user-1', role: 'owner', email: 'test@example.com' }
            );
         });

         it('should return 403 when user has no permission', async () => {
            mockRestaurantService.updateRestaurant.mockRejectedValue(
               new Error('You do not have permission to update this restaurant')
            );

            const app = createProtectedApp();

            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1', {
                  method: 'PUT',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-2',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify({ name: 'Updated Name' })
               })
            );
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
         });
      });

      describe('DELETE /:id', () => {
         it('should delete restaurant successfully', async () => {
            const mockDeletedRestaurant = {
               id: 'restaurant-1',
               name: 'Deleted Restaurant'
            };

            mockRestaurantService.deleteRestaurant.mockResolvedValue(mockDeletedRestaurant);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/restaurant-1', {
                  method: 'DELETE',
                  headers: {
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  }
               })
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Restaurant deleted successfully');
            expect(data.data.deletedRestaurant).toEqual(mockDeletedRestaurant);
            expect(mockRestaurantService.deleteRestaurant).toHaveBeenCalledWith('restaurant-1');
         });

         it('should return 404 when restaurant not found', async () => {
            mockRestaurantService.deleteRestaurant.mockRejectedValue(new Error('Restaurant not found'));

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/nonexistent', {
                  method: 'DELETE',
                  headers: {
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  }
               })
            );
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Restaurant not found');
         });
      });

      describe('GET /owner/my-restaurants', () => {
         it('should get owner restaurants successfully', async () => {
            const mockRestaurants = [
               {
                  id: 'restaurant-1',
                  ownerId: 'user-1',
                  name: 'My Restaurant 1'
               },
               {
                  id: 'restaurant-2',
                  ownerId: 'user-1',
                  name: 'My Restaurant 2'
               }
            ];

            mockRestaurantService.getOwnerRestaurants.mockResolvedValue(mockRestaurants);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/owner/my-restaurants', {
                  headers: {
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  }
               })
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.data.restaurants).toEqual(mockRestaurants);
            expect(mockRestaurantService.getOwnerRestaurants).toHaveBeenCalledWith('user-1');
         });

         it('should handle error when getting owner restaurants', async () => {
            mockRestaurantService.getOwnerRestaurants.mockRejectedValue(new Error('Database error'));

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/owner/my-restaurants', {
                  headers: {
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  }
               })
            );
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Database error');
         });

         it('should return 401 when missing authentication headers', async () => {
            const app = createProtectedApp(); // No headers provided
            const response = await app.handle(
               new Request('http://localhost/api/restaurant/owner/my-restaurants')
            );

            expect(response.status).toBe(401);
         });
      });
   });
});