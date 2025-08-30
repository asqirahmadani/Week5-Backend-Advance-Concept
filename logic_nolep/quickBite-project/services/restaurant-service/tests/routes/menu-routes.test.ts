import { describe, it, expect, beforeEach, mock } from "bun:test";
import { menuRoutes } from "../../src/routes/menu.routes";
import { Elysia } from "elysia";

describe('Menu Routes', () => {
   let mockRestaurantService: any;

   beforeEach(() => {
      // Mock restaurant service with all menu-related methods
      mockRestaurantService = {
         getMenuCategory: mock(),
         getMenuItemById: mock(),
         createMenuCategory: mock(),
         createMenuItem: mock(),
         updateMenuItem: mock(),
         deleteMenuItem: mock()
      };
   });

   // Helper function to create app with mocked service for public routes
   const createPublicApp = () => {
      return new Elysia()
         .derive(() => ({
            db: {}, // Mock db
            restaurantService: mockRestaurantService // Inject mock service
         }))
         .use(menuRoutes);
   };

   // Helper function to create app with mocked service for protected routes
   const createProtectedApp = () => {
      return new Elysia()
         .derive(() => ({
            db: {}, // Mock db
            restaurantService: mockRestaurantService // Inject mock service
         }))
         .use(menuRoutes);
   };

   describe('Public Routes', () => {
      describe('GET /categories/:restaurantId', () => {
         it('should get menu categories successfully', async () => {
            const mockCategories = {
               restaurant: 'Test Restaurant',
               categories: [
                  {
                     id: 'category-1',
                     name: 'Main Course',
                     sortOder: 1
                  },
                  {
                     id: 'category-2',
                     name: 'Desserts',
                     sortOder: 2
                  }
               ]
            };

            mockRestaurantService.getMenuCategory.mockResolvedValue(mockCategories);

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/categories/restaurant-1')
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Get Categories successfully');
            expect(data.data).toEqual(mockCategories);
            expect(mockRestaurantService.getMenuCategory).toHaveBeenCalledWith('restaurant-1');
         });

         it('should handle error when getting categories', async () => {
            mockRestaurantService.getMenuCategory.mockRejectedValue(new Error('Restaurant not found'));

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/categories/nonexistent')
            );
            const data = await response.json();

            expect(response.status).toBe(400);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Restaurant not found');
         });
      });

      describe('GET /items/:itemsId', () => {
         it('should get menu item by id successfully', async () => {
            const mockItem = {
               id: 'item-1',
               name: 'Pasta Carbonara',
               description: 'Delicious pasta with bacon and eggs',
               price: 25000,
               preparationTime: 15,
               isAvailable: true
            };

            mockRestaurantService.getMenuItemById.mockResolvedValue(mockItem);

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1')
            );
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Get menu item successfully');
            expect(data.data.item).toEqual(mockItem);
            expect(mockRestaurantService.getMenuItemById).toHaveBeenCalledWith('item-1');
         });

         it('should return 404 when menu item not found', async () => {
            mockRestaurantService.getMenuItemById.mockRejectedValue(new Error('Menu item not found'));

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/nonexistent')
            );
            const data = await response.json();

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Menu item not found');
         });

         it('should return 403 for other errors', async () => {
            mockRestaurantService.getMenuItemById.mockRejectedValue(new Error('Permission denied'));

            const app = createPublicApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1')
            );
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Permission denied');
         });
      });
   });

   describe('Protected Routes', () => {
      describe('POST /categories', () => {
         it('should create menu category successfully', async () => {
            const categoryData = {
               restaurantId: 'restaurant-1',
               name: 'Appetizers',
               description: 'Start your meal right',
               sortOrder: 1
            };

            const mockCreatedCategory = {
               id: 'category-1',
               restaurantId: 'restaurant-1',
               name: 'Appetizers',
               description: 'Start your meal right',
               sortOrder: 1,
               isActive: true
            };

            mockRestaurantService.createMenuCategory.mockResolvedValue(mockCreatedCategory);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/categories', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  },
                  body: JSON.stringify(categoryData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Category created successfully');
            expect(data.data.category).toEqual(mockCreatedCategory);
            expect(mockRestaurantService.createMenuCategory).toHaveBeenCalledWith(
               categoryData,
               { sub: 'user-1', role: 'owner', email: 'test@example.com' }
            );
         });

         it('should handle validation error when creating category', async () => {
            const invalidData = {
               restaurantId: 'restaurant-1'
               // Missing required name field
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/categories', {
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

         it('should return 403 when user has no permission to create category', async () => {
            mockRestaurantService.createMenuCategory.mockRejectedValue(
               new Error('You do not have permission to add categories to this restaurant')
            );

            const categoryData = {
               restaurantId: 'restaurant-1',
               name: 'Appetizers'
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/categories', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-2',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(categoryData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
            expect(data.message).toBe('You do not have permission to add categories to this restaurant');
         });

         it('should return 401 when missing authentication headers', async () => {
            const categoryData = {
               restaurantId: 'restaurant-1',
               name: 'Appetizers'
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/categories', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(categoryData)
               })
            );

            expect(response.status).toBe(401);
         });
      });

      describe('POST /items', () => {
         it('should create menu item successfully', async () => {
            const itemData = {
               restaurantId: 'restaurant-1',
               categoryId: 'category-1',
               name: 'Pasta Carbonara',
               description: 'Delicious pasta with bacon and eggs',
               price: 25000,
               preparationTime: 15
            };

            const mockCreatedItem = {
               id: 'item-1',
               restaurantId: 'restaurant-1',
               categoryId: 'category-1',
               name: 'Pasta Carbonara',
               description: 'Delicious pasta with bacon and eggs',
               price: 25000,
               preparationTime: 15,
               isAvailable: true,
               createdAt: `${new Date()}`
            };

            mockRestaurantService.createMenuItem.mockResolvedValue(mockCreatedItem);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'owner',
                     'x-user-email': 'test@example.com'
                  },
                  body: JSON.stringify(itemData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(201);
            expect(data.success).toBe(true);
            expect(data.message).toBe('Menu item created successfully');
            expect(data.data.item).toEqual(mockCreatedItem);
            expect(mockRestaurantService.createMenuItem).toHaveBeenCalledWith(
               itemData,
               { sub: 'user-1', role: 'owner', email: 'test@example.com' }
            );
         });

         it('should handle validation error when creating menu item', async () => {
            const invalidData = {
               restaurantId: 'restaurant-1',
               categoryId: 'category-1',
               name: 'Pasta Carbonara'
               // Missing required price field
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items', {
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

         it('should return 403 when user has no permission to create menu item', async () => {
            mockRestaurantService.createMenuItem.mockRejectedValue(
               new Error('You do not have permission to add categories to this restaurant')
            );

            const itemData = {
               restaurantId: 'restaurant-1',
               categoryId: 'category-1',
               name: 'Pasta Carbonara',
               price: 25000
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-2',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(itemData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
         });
      });

      describe('PUT /items/:id', () => {
         it('should update menu item successfully', async () => {
            const updateData = {
               restaurantId: 'restaurant-1',
               name: 'Updated Pasta Carbonara',
               description: 'Updated delicious pasta',
               price: 30000,
               isAvailable: true,
               preparationTime: 20
            };

            const mockUpdatedItem = {
               id: 'item-1',
               restaurantId: 'restaurant-1',
               categoryId: 'category-1',
               name: 'Updated Pasta Carbonara',
               description: 'Updated delicious pasta',
               price: 30000,
               isAvailable: true,
               preparationTime: 20,
               updatedAt: `${new Date()}`
            };

            mockRestaurantService.updateMenuItem.mockResolvedValue(mockUpdatedItem);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1', {
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
            expect(data.message).toBe('Menu item updated successfully');
            expect(data.data.item).toEqual(mockUpdatedItem);
            expect(mockRestaurantService.updateMenuItem).toHaveBeenCalledWith(
               'item-1',
               updateData,
               { sub: 'user-1', role: 'owner', email: 'test@example.com' }
            );
         });

         it('should return 404 when menu item not found', async () => {
            mockRestaurantService.updateMenuItem.mockRejectedValue(new Error('Menu item not found'));

            const updateData = {
               restaurantId: 'restaurant-1',
               name: 'Updated Item'
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/nonexistent', {
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

            expect(response.status).toBe(404);
            expect(data.success).toBe(false);
            expect(data.message).toBe('Menu item not found');
         });

         it('should return 403 when user has no permission to update menu item', async () => {
            mockRestaurantService.updateMenuItem.mockRejectedValue(
               new Error('You do not have permission to add categories to this restaurant')
            );

            const updateData = {
               restaurantId: 'restaurant-1',
               name: 'Updated Item'
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1', {
                  method: 'PUT',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-2',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(updateData)
               })
            );
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
         });

         it('should handle validation error when updating menu item', async () => {
            const invalidData = {
               restaurantId: 123 // Should be string
            };

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1', {
                  method: 'PUT',
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
      });

      describe('DELETE /items/:id', () => {
         it('should delete menu item successfully', async () => {
            const mockDeletedItem = {
               id: 'item-1',
               name: 'Deleted Item'
            };

            mockRestaurantService.deleteMenuItem.mockResolvedValue(mockDeletedItem);

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1', {
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
            expect(data.message).toBe('Menu item deleted successfully');
            expect(data.data.deletedItem).toEqual(mockDeletedItem);
            expect(mockRestaurantService.deleteMenuItem).toHaveBeenCalledWith(
               'item-1',
               { sub: 'user-1', role: 'owner', email: 'test@example.com' }
            );
         });

         it('should return 404 when menu item not found', async () => {
            mockRestaurantService.deleteMenuItem.mockRejectedValue(new Error('Menu item not found'));

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/nonexistent', {
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
            expect(data.message).toBe('Menu item not found');
         });

         it('should return 403 when user has no permission to delete menu item', async () => {
            mockRestaurantService.deleteMenuItem.mockRejectedValue(
               new Error('You do not have permission to add categories to this restaurant')
            );

            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1', {
                  method: 'DELETE',
                  headers: {
                     'x-user-id': 'user-2',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  }
               })
            );
            const data = await response.json();

            expect(response.status).toBe(403);
            expect(data.success).toBe(false);
         });

         it('should return 401 when missing authentication headers', async () => {
            const app = createProtectedApp();
            const response = await app.handle(
               new Request('http://localhost/api/menus/items/item-1', {
                  method: 'DELETE'
               })
            );

            expect(response.status).toBe(401);
         });
      });
   });
});