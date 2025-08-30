import { describe, it, expect, beforeEach, mock } from "bun:test";
import { RestaurantService } from "../../src/services/restaurant.service";
import { restaurant } from "../../src/db/schema";
import { isAsync } from "elysia/compose";

describe('Restaurant Service', () => {
   let restaurantService: RestaurantService;
   let mockDb: any;

   beforeEach(() => {
      // create mock database with chainable methods
      mockDb = {
         select: mock(() => mockDb),
         from: mock(() => mockDb),
         where: mock(() => mockDb),
         limit: mock(() => mockDb),
         offset: mock(() => mockDb),
         orderBy: mock(() => mockDb),
         insert: mock(() => mockDb),
         values: mock(() => mockDb),
         returning: mock(() => mockDb),
         update: mock(() => mockDb),
         set: mock(() => mockDb),
         delete: mock(() => mockDb)
      };

      restaurantService = new RestaurantService(mockDb);
   });

   describe('getAllRestaurants', () => {
      it('should get all restaurants without filters', async () => {
         const mockRestaurants = [
            {
               id: 'restaurant-1',
               name: 'Restaurant One',
               description: 'Great food',
               cuisineType: 'Italian',
               city: 'Jakarta',
               rating: '4.5',
               deliveryFee: '3.00',
               minimumOrder: '10.00',
               estimatedPrepTime: 30,
               isActive: true,
               isOpen: true
            },
            {
               id: 'restaurant-2',
               name: 'Restaurant Two',
               description: 'Amazing taste',
               cuisineType: 'Japanese',
               city: 'Surabaya',
               rating: '4.8',
               deliveryFee: '5.00',
               minimumOrder: '15.00',
               estimatedPrepTime: 25,
               isActive: true,
               isOpen: true
            }
         ];

         // Mock the query chain - when no filters, it should not call where()
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(mockDb);
         mockDb.offset.mockReturnValue(Promise.resolve(mockRestaurants));

         const result = await restaurantService.getAllRestaurants(1, 10);

         expect(mockDb.select).toHaveBeenCalledWith({
            id: expect.any(Object),
            name: expect.any(Object),
            description: expect.any(Object),
            cuisineType: expect.any(Object),
            city: expect.any(Object),
            rating: expect.any(Object),
            deliveryFee: expect.any(Object),
            minimumOrder: expect.any(Object),
            estimatedPrepTime: expect.any(Object),
            isActive: expect.any(Object),
            isOpen: expect.any(Object)
         });
         expect(mockDb.from).toHaveBeenCalled();
         expect(mockDb.limit).toHaveBeenCalledWith(10);
         expect(mockDb.offset).toHaveBeenCalledWith(0);
         expect(result).toEqual(mockRestaurants);
      });

      it('should get restaurants with city filter', async () => {
         const mockRestaurants = [
            {
               id: 'restaurant-1',
               name: 'Restaurant One',
               description: 'Great food',
               cuisineType: 'Italian',
               city: 'Jakarta',
               rating: '4.5',
               deliveryFee: '3.00',
               minimumOrder: '10.00',
               estimatedPrepTime: 30,
               isActive: true,
               isOpen: true
            }
         ];

         // Mock the query chain with filters
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(mockDb);
         mockDb.offset.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(Promise.resolve(mockRestaurants));

         const result = await restaurantService.getAllRestaurants(1, 10, { city: 'Jakarta' });

         expect(mockDb.where).toHaveBeenCalled();
         expect(result).toEqual(mockRestaurants);
      });

      it('should get restaurants with multiple filters', async () => {
         const mockRestaurants = [
            {
               id: 'restaurant-1',
               name: 'Italian Restaurant',
               description: 'Authentic Italian cuisine',
               cuisineType: 'Italian',
               city: 'Jakarta',
               rating: '4.7',
               deliveryFee: '3.00',
               minimumOrder: '15.00',
               estimatedPrepTime: 25,
               isActive: true,
               isOpen: true
            }
         ];

         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(mockDb);
         mockDb.offset.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(Promise.resolve(mockRestaurants));

         const result = await restaurantService.getAllRestaurants(1, 10, {
            city: 'Jakarta',
            cuisine: 'Italian',
            isActive: true
         });

         expect(mockDb.where).toHaveBeenCalled();
         expect(result).toEqual(mockRestaurants);
      });
   });

   describe('getRestaurantCount', () => {
      it('should get total count without filters', async () => {
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(Promise.resolve([{ count: 25 }]));

         const result = await restaurantService.getRestaurantCount();

         expect(mockDb.select).toHaveBeenCalledWith({
            count: expect.any(Object)
         });
         expect(result).toBe(25);
      });

      it('should get total count with filters', async () => {
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(Promise.resolve([{ count: 10 }]));

         const result = await restaurantService.getRestaurantCount({ city: 'Jakarta' });

         expect(mockDb.where).toHaveBeenCalled();
         expect(result).toBe(10);
      });
   });

   describe('getRestaurantById', () => {
      it('should get restaurant by ID successfully', async () => {
         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'Test Restaurant',
            description: 'Great food',
            cuisineType: 'Italian',
            address: '123 Main St',
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: '+62123456789',
            email: 'test@restaurant.com',
            rating: '4.5',
            totalReviews: 10,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '10.00',
            estimatedPrepTime: 30,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([mockRestaurant]));

         const result = await restaurantService.getRestaurantById('restaurant-1');

         expect(mockDb.where).toHaveBeenCalled();
         expect(mockDb.limit).toHaveBeenCalledWith(1);
         expect(result).toEqual(mockRestaurant);
      });

      it('should throw error when restaurant not found', async () => {
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([]));

         await expect(restaurantService.getRestaurantById('nonexistent')).rejects.toThrow('Restaurant not found');
      });
   });

   describe('createRestaurant', () => {
      it('should create restaurant successfully', async () => {
         const restaurantData = {
            ownerId: 'owner-1',
            name: 'New Restaurant',
            description: 'Great food',
            cuisineType: 'Italian',
            city: 'Jakarta',
            email: 'restaurant@example.com'
         };

         const mockCreatedRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'New Restaurant',
            description: 'Great food',
            cuisineType: 'Italian',
            address: null,
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: null,
            email: 'restaurant@example.com',
            rating: '0',
            totalReviews: 0,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '1.00',
            estimatedPrepTime: 10,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: null
         };

         mockDb.insert.mockReturnValue(mockDb);
         mockDb.values.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([mockCreatedRestaurant]));

         const result = await restaurantService.createRestaurant(restaurantData);

         expect(mockDb.insert).toHaveBeenCalled();
         expect(mockDb.values).toHaveBeenCalledWith({
            ...restaurantData,
            createdAt: expect.any(Date)
         });
         expect(mockDb.returning).toHaveBeenCalled();
         expect(result).toEqual(mockCreatedRestaurant);
      });
   });

   describe('updateRestaurant', () => {
      it('should update restaurant successfully (owner)', async () => {
         const existingRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'Old Restaurant',
            description: 'Old description',
            cuisineType: 'Italian',
            address: '123 Old St',
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: '+62123456789',
            email: 'old@restaurant.com',
            rating: '4.0',
            totalReviews: 5,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '10.00',
            estimatedPrepTime: 30,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: null
         };

         const updateData = {
            name: 'Updated Restaurant',
            description: 'Updated description'
         };

         const updatedRestaurant = {
            ...existingRestaurant,
            ...updateData,
            updatedAt: new Date()
         };

         const user = { sub: 'owner-1', role: 'owner' };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValueOnce(Promise.resolve([existingRestaurant]));

         // Mock update
         mockDb.update.mockReturnValue(mockDb);
         mockDb.set.mockReturnValue(mockDb);
         // Reset where mock for update operation
         mockDb.where.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([updatedRestaurant]));

         const result = await restaurantService.updateRestaurant('restaurant-1', updateData, user);

         expect(mockDb.update).toHaveBeenCalled();
         expect(mockDb.set).toHaveBeenCalledWith({
            ...updateData,
            updatedAt: expect.any(Date)
         });
         expect(result).toEqual(updatedRestaurant);
      });

      it('should update restaurant successfully (admin)', async () => {
         const existingRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'Old Restaurant',
            description: 'Old description',
            cuisineType: 'Italian',
            address: '123 Old St',
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: '+62123456789',
            email: 'old@restaurant.com',
            rating: '4.0',
            totalReviews: 5,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '10.00',
            estimatedPrepTime: 30,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: null
         };

         const updateData = { name: 'Updated Restaurant' };
         const user = { sub: 'admin-1', role: 'admin' };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValueOnce(Promise.resolve([existingRestaurant]));

         // Mock update
         mockDb.update.mockReturnValue(mockDb);
         mockDb.set.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([{ ...existingRestaurant, ...updateData }]));

         const result = await restaurantService.updateRestaurant('restaurant-1', updateData, user);

         expect(result).toEqual({ ...existingRestaurant, ...updateData });
      });

      it('should throw error when user has no permission', async () => {
         const existingRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1'
         };

         const user = { sub: 'other-user', role: 'customer' };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([existingRestaurant]));

         await expect(
            restaurantService.updateRestaurant('restaurant-1', {}, user)
         ).rejects.toThrow('You do not have permission to update this restaurant');
      });
   });

   describe('updateRestaurantRating', () => {
      it('should update restaurant rating successfully', async () => {
         const existingRestaurant = {
            id: 'restaurant-1',
            rating: '4.0',
            totalReviews: 10
         };

         const updatedRestaurant = {
            ...existingRestaurant,
            rating: '4.1',
            totalReviews: 11,
            updatedAt: new Date()
         };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValueOnce(Promise.resolve([existingRestaurant]));

         // Mock update
         mockDb.update.mockReturnValue(mockDb);
         mockDb.set.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([updatedRestaurant]));

         const result = await restaurantService.updateRestaurantRating('restaurant-1', 5, 'review-1');

         expect(result).toEqual({
            restaurantId: 'restaurant-1',
            previousRating: 4.0,
            newAverageRating: 4.09, // (4.0 * 10 + 5) / 11 = 4.09 rounded
            totalReviews: 11,
            reviewId: 'review-1'
         });
      });

      it('should handle first review (no previous rating)', async () => {
         const existingRestaurant = {
            id: 'restaurant-1',
            rating: '0',
            totalReviews: 0
         };

         const updatedRestaurant = {
            ...existingRestaurant,
            rating: '5.0',
            totalReviews: 1
         };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValueOnce(Promise.resolve([existingRestaurant]));

         // Mock update
         mockDb.update.mockReturnValue(mockDb);
         mockDb.set.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([updatedRestaurant]));

         const result = await restaurantService.updateRestaurantRating('restaurant-1', 5, 'review-1');

         expect(result.newAverageRating).toBe(5);
         expect(result.totalReviews).toBe(1);
      });
   });

   describe('deleteRestaurant', () => {
      it('should delete restaurant successfully', async () => {
         const existingRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'Test Restaurant',
            description: 'Great food',
            cuisineType: 'Italian',
            address: '123 Main St',
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: '+62123456789',
            email: 'test@restaurant.com',
            rating: '4.5',
            totalReviews: 10,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '10.00',
            estimatedPrepTime: 30,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         // Mock getRestaurantById with complete chain
         mockDb.select.mockReturnValueOnce(mockDb);
         mockDb.from.mockReturnValueOnce(mockDb);
         mockDb.where.mockReturnValueOnce(mockDb);
         mockDb.limit.mockReturnValueOnce(Promise.resolve([existingRestaurant]));

         // Mock delete with complete chain
         mockDb.delete.mockReturnValueOnce(mockDb);
         mockDb.where.mockReturnValueOnce(Promise.resolve());

         const result = await restaurantService.deleteRestaurant('restaurant-1');

         expect(mockDb.delete).toHaveBeenCalled();
         expect(result).toEqual({
            name: existingRestaurant.name,
            id: existingRestaurant.id
         });
      });
   });

   describe('getOwnerRestaurants', () => {
      it('should get owner restaurants successfully', async () => {
         const mockRestaurants = [
            {
               id: 'restaurant-1',
               ownerId: 'owner-1',
               name: 'Restaurant 1',
               description: 'Great food 1',
               cuisineType: 'Italian',
               address: '123 Main St',
               city: 'Jakarta',
               latitude: null,
               longitude: null,
               phone: '+62123456789',
               email: 'restaurant1@example.com',
               rating: '4.5',
               totalReviews: 10,
               isActive: true,
               isVerified: false,
               deliveryFee: '3.00',
               minimumOrder: '10.00',
               estimatedPrepTime: 30,
               isOpen: true,
               createdAt: new Date(),
               updatedAt: new Date()
            },
            {
               id: 'restaurant-2',
               ownerId: 'owner-1',
               name: 'Restaurant 2',
               description: 'Great food 2',
               cuisineType: 'Japanese',
               address: '456 Second St',
               city: 'Jakarta',
               latitude: null,
               longitude: null,
               phone: '+62123456790',
               email: 'restaurant2@example.com',
               rating: '4.7',
               totalReviews: 15,
               isActive: true,
               isVerified: false,
               deliveryFee: '4.00',
               minimumOrder: '12.00',
               estimatedPrepTime: 25,
               isOpen: true,
               createdAt: new Date(),
               updatedAt: new Date()
            }
         ];

         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(Promise.resolve(mockRestaurants));

         const result = await restaurantService.getOwnerRestaurants('owner-1');

         expect(mockDb.where).toHaveBeenCalled();
         expect(result).toEqual(mockRestaurants);
      });
   });

   describe('getRestaurantMenu', () => {
      it('should get restaurant menu successfully', async () => {
         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'Test Restaurant',
            description: 'Great food',
            cuisineType: 'Italian',
            address: '123 Main St',
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: '+62123456789',
            email: 'test@restaurant.com',
            rating: '4.5',
            totalReviews: 10,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '10.00',
            estimatedPrepTime: 30,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         const mockCategories = [
            {
               id: 'category-1',
               category: 'Main Course',
               description: 'Main dishes',
               sortOrder: 1
            }
         ];

         const mockMenus = [
            {
               id: 'item-1',
               name: 'Pasta',
               description: 'Delicious pasta',
               price: '15.00',
               preparationTime: 20
            }
         ];

         // Mock getRestaurantById with separate mock chain
         const getByIdMockDb = {
            select: mock(() => getByIdMockDb),
            from: mock(() => getByIdMockDb),
            where: mock(() => getByIdMockDb),
            limit: mock(() => Promise.resolve([mockRestaurant]))
         };

         mockDb.select.mockReturnValueOnce(getByIdMockDb);

         // Create separate mock objects for each query to avoid interference
         const categoryMockDb = {
            select: mock(() => categoryMockDb),
            from: mock(() => categoryMockDb),
            where: mock(() => categoryMockDb),
            orderBy: mock(() => Promise.resolve(mockCategories))
         };

         const menuMockDb = {
            select: mock(() => menuMockDb),
            from: mock(() => menuMockDb),
            where: mock(() => Promise.resolve(mockMenus))
         };

         // Mock categories query
         mockDb.select.mockReturnValueOnce(categoryMockDb);

         // Mock menu items query
         mockDb.select.mockReturnValueOnce(menuMockDb);

         const result = await restaurantService.getRestaurantMenu('restaurant-1');

         expect(result).toEqual({
            restaurant: mockRestaurant.name,
            menu: [
               {
                  ...mockCategories[0],
                  menus: mockMenus
               }
            ]
         });
      });
   });

   describe('getMenuCategory', () => {
      it('should get menu categories successfully', async () => {
         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1',
            name: 'Test Restaurant',
            description: 'Great food',
            cuisineType: 'Italian',
            address: '123 Main St',
            city: 'Jakarta',
            latitude: null,
            longitude: null,
            phone: '+62123456789',
            email: 'test@restaurant.com',
            rating: '4.5',
            totalReviews: 10,
            isActive: true,
            isVerified: false,
            deliveryFee: '3.00',
            minimumOrder: '10.00',
            estimatedPrepTime: 30,
            isOpen: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         const mockCategories = [
            { id: 'category-1', name: 'Main Course', sortOder: 1 },
            { id: 'category-2', name: 'Desserts', sortOder: 2 }
         ];

         // Mock getRestaurantById with complete chain
         mockDb.select.mockReturnValueOnce(mockDb);
         mockDb.from.mockReturnValueOnce(mockDb);
         mockDb.where.mockReturnValueOnce(mockDb);
         mockDb.limit.mockReturnValueOnce(Promise.resolve([mockRestaurant]));

         // Mock categories query with complete chain
         mockDb.select.mockReturnValueOnce(mockDb);
         mockDb.from.mockReturnValueOnce(mockDb);
         mockDb.where.mockReturnValueOnce(Promise.resolve(mockCategories));

         const result = await restaurantService.getMenuCategory('restaurant-1');

         expect(result).toEqual({
            restaurant: mockRestaurant.name,
            categories: mockCategories
         });
      });
   });

   describe('createMenuCategory', () => {
      it('should create menu category successfully (owner)', async () => {
         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1'
         };

         const categoryData = {
            restaurantId: 'restaurant-1',
            name: 'New Category',
            description: 'Category description',
            sortOrder: 1
         };

         const mockCreatedCategory = {
            id: 'category-1',
            ...categoryData,
            isActive: true
         };

         const user = { sub: 'owner-1', role: 'owner' };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([mockRestaurant]));

         // Mock insert
         mockDb.insert.mockReturnValue(mockDb);
         mockDb.values.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([mockCreatedCategory]));

         const result = await restaurantService.createMenuCategory(categoryData, user);

         expect(mockDb.values).toHaveBeenCalledWith({
            restaurantId: categoryData.restaurantId,
            name: categoryData.name,
            description: categoryData.description,
            sortOrder: categoryData.sortOrder,
            isActive: true
         });
         expect(result).toEqual(mockCreatedCategory);
      });

      it('should throw error when user has no permission', async () => {
         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1'
         };

         const user = { sub: 'other-user', role: 'customer' };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([mockRestaurant]));

         await expect(
            restaurantService.createMenuCategory({ restaurantId: 'restaurant-1' }, user)
         ).rejects.toThrow('You do not have permission to add categories to this restaurant');
      });
   });

   describe('getMenuItemById', () => {
      it('should get menu item by ID successfully', async () => {
         const mockMenuItem = {
            id: 'item-1',
            restaurantId: 'restaurant-1',
            categoryId: 'category-1',
            name: 'Pasta',
            description: 'Delicious pasta',
            price: '15.00',
            isAvailable: true,
            preparationTime: 20,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([mockMenuItem]));

         const result = await restaurantService.getMenuItemById('item-1');

         expect(result).toEqual(mockMenuItem);
      });

      it('should throw error when menu item not found', async () => {
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([]));

         await expect(restaurantService.getMenuItemById('nonexistent')).rejects.toThrow('Menu item not found');
      });
   });

   describe('createMenuItem', () => {
      it('should create menu item successfully', async () => {
         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1'
         };

         const itemData = {
            restaurantId: 'restaurant-1',
            categoryId: 'category-1',
            name: 'New Item',
            description: 'Item description',
            price: '20.00',
            preparationTime: 15
         };

         const mockCreatedItem = {
            id: 'item-1',
            ...itemData,
            isAvailable: true,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         const user = { sub: 'owner-1', role: 'owner' };

         // Mock getRestaurantById
         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([mockRestaurant]));

         // Mock insert
         mockDb.insert.mockReturnValue(mockDb);
         mockDb.values.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([mockCreatedItem]));

         const result = await restaurantService.createMenuItem(itemData, user);

         expect(result).toEqual(mockCreatedItem);
      });
   });

   describe('updateMenuItem', () => {
      it('should update menu item successfully', async () => {
         const mockItem = {
            id: 'item-1',
            restaurantId: 'restaurant-1',
            categoryId: 'category-1',
            name: 'Test Item',
            description: 'Item description',
            isAvailable: true,
            preparationTime: 20,
            createdAt: new Date()
         };

         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1'
         };

         const updateData = {
            restaurantId: 'restaurant-1',
            name: 'Updated Item',
            price: '25.00'
         };

         const mockUpdatedItem = {
            ...mockItem,
            ...updateData,
            updatedAt: new Date()
         };

         const user = { sub: 'owner-1', role: 'owner' };

         // Mock get item - use separate mock chain
         const itemMockDb = {
            select: mock(() => itemMockDb),
            from: mock(() => itemMockDb),
            where: mock(() => itemMockDb),
            limit: mock(() => Promise.resolve([mockItem]))
         };

         mockDb.select.mockReturnValueOnce(itemMockDb);

         // Mock getRestaurantById
         const restaurantMockDb = {
            select: mock(() => restaurantMockDb),
            from: mock(() => restaurantMockDb),
            where: mock(() => restaurantMockDb),
            limit: mock(() => Promise.resolve([mockRestaurant]))
         };

         mockDb.select.mockReturnValueOnce(restaurantMockDb);

         // Mock update
         mockDb.update.mockReturnValue(mockDb);
         mockDb.set.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.returning.mockReturnValue(Promise.resolve([mockUpdatedItem]));

         const result = await restaurantService.updateMenuItem('item-1', updateData, user);

         expect(result).toEqual(mockUpdatedItem);
      });

      it('should throw error when menu item not found', async () => {
         const user = { sub: 'owner-1', role: 'owner' };

         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([]));

         await expect(
            restaurantService.updateMenuItem('nonexistent', {}, user)
         ).rejects.toThrow('Menu item not found');
      });
   });

   describe('deleteMenuItem', () => {
      it('should delete menu item successfully', async () => {
         const mockItem = {
            id: 'item-1',
            restaurantId: 'restaurant-1',
            name: 'Test Item'
         };

         const mockRestaurant = {
            id: 'restaurant-1',
            ownerId: 'owner-1'
         };

         const user = { sub: 'owner-1', role: 'owner' };

         // Mock get item - use separate mock chain
         const itemMockDb = {
            select: mock(() => itemMockDb),
            from: mock(() => itemMockDb),
            where: mock(() => itemMockDb),
            limit: mock(() => Promise.resolve([mockItem]))
         };

         mockDb.select.mockReturnValueOnce(itemMockDb);

         // Mock getRestaurantById
         const restaurantMockDb = {
            select: mock(() => restaurantMockDb),
            from: mock(() => restaurantMockDb),
            where: mock(() => restaurantMockDb),
            limit: mock(() => Promise.resolve([mockRestaurant]))
         };

         mockDb.select.mockReturnValueOnce(restaurantMockDb);

         // Mock delete
         mockDb.delete.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(Promise.resolve());

         const result = await restaurantService.deleteMenuItem('item-1', user);

         expect(result).toEqual({
            name: mockItem.name,
            id: mockItem.id
         });
      });

      it('should throw error when menu item not found', async () => {
         const user = { sub: 'owner-1', role: 'owner' };

         mockDb.select.mockReturnValue(mockDb);
         mockDb.from.mockReturnValue(mockDb);
         mockDb.where.mockReturnValue(mockDb);
         mockDb.limit.mockReturnValue(Promise.resolve([]));

         await expect(
            restaurantService.deleteMenuItem('nonexistent', user)
         ).rejects.toThrow('Menu item not found');
      });
   });
});