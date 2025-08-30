import { db, Database } from "../db/client";
import { and, eq, sql, like, ilike } from "drizzle-orm";
import { menuCategories, menuItems, restaurant } from "../db/schema";

interface RestaurantFilters {
   city?: string;
   cuisine?: string;
   isActive?: boolean;
}

export class RestaurantService {
   private db: Database;

   constructor(private injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
   }

   async getAllRestaurants(page: number = 1, limit: number = 10, filters: RestaurantFilters = {}) {
      const offset = (page - 1) * limit;

      let whereClause: any = [];

      if (filters.city) {
         whereClause.push(ilike(restaurant.city, `%${filters.city}%`));
      }

      if (filters.cuisine) {
         whereClause.push(ilike(restaurant.cuisineType, `%${filters.cuisine}%`));
      }

      if (filters.isActive !== undefined) {
         whereClause.push(eq(restaurant.isActive, filters.isActive));
      }

      const query = this.db.select({
         id: restaurant.id,
         name: restaurant.name,
         description: restaurant.description,
         cuisineType: restaurant.cuisineType,
         city: restaurant.city,
         rating: restaurant.rating,
         deliveryFee: restaurant.deliveryFee,
         minimumOrder: restaurant.minimumOrder,
         estimatedPrepTime: restaurant.estimatedPrepTime,
         isActive: restaurant.isActive,
         isOpen: restaurant.isOpen
      })
         .from(restaurant)
         .limit(limit)
         .offset(offset)

      if (whereClause.length > 0) {
         return await query.where(and(...whereClause))
      }

      return await query;
   }

   async getRestaurantCount(filters: RestaurantFilters = {}): Promise<number> {
      let whereClause: any = [];

      if (filters.city) {
         whereClause.push(ilike(restaurant.city, `%${filters.city}%`));
      }

      if (filters.cuisine) {
         whereClause.push(ilike(restaurant.cuisineType, `%${filters.cuisine}%`));
      }

      if (filters.isActive !== undefined) {
         whereClause.push(eq(restaurant.isActive, filters.isActive));
      }

      let query: any = this.db.select({
         count: sql<number>`count(*)`
      }).from(restaurant);

      if (whereClause.length > 0) {
         query = query.where(and(...whereClause));
      }

      const [{ count }] = await query;
      return count;
   }

   async getRestaurantById(id: string) {
      const [rest] = await this.db.select()
         .from(restaurant)
         .where(eq(restaurant.id, id))
         .limit(1);

      if (!rest) {
         throw new Error('Restaurant not found');
      }

      return rest;
   }

   async createRestaurant(data: any) {
      const [NewRestaurant] = await this.db.insert(restaurant)
         .values({
            ...data,
            createdAt: new Date()
         })
         .returning();

      return NewRestaurant;
   }

   async updateRestaurant(id: string, data: any, user: any) {
      const existingRestaurant = await this.getRestaurantById(id);

      if (user.role !== 'admin' && existingRestaurant.ownerId !== user.sub) {
         throw new Error('You do not have permission to update this restaurant');
      }

      const [updatedRestaurant] = await this.db.update(restaurant)
         .set({ ...data, updatedAt: new Date() })
         .where(eq(restaurant.id, id))
         .returning();

      return updatedRestaurant;
   }

   async updateRestaurantRating(restaurantId: string, newRating: number, reviewId: string) {
      try {
         // get current restaurant data
         const currentRestaurant = await this.getRestaurantById(restaurantId);

         // calculate new average rating
         const currentRating = parseFloat(currentRestaurant.rating || '0');
         const currentTotalReviews = currentRestaurant.totalReviews || 0;
         const newTotalReviews = currentTotalReviews + 1;

         // calculate new average
         const newAverageRating = ((currentRating * currentTotalReviews) + newRating) / newTotalReviews;
         const roundedRating = Math.round(newAverageRating * 100) / 100;

         // update restaurant with new rating and review count
         const [updatedRestaurant] = await this.db.update(restaurant)
            .set({
               rating: roundedRating.toString(),
               totalReviews: newTotalReviews,
               updatedAt: new Date()
            })
            .where(eq(restaurant.id, restaurantId))
            .returning();

         console.log(`Restaurant ${restaurantId} rating updated: ${currentRating} -> ${roundedRating} (${newTotalReviews} reviews)`);

         return {
            restaurantId,
            previousRating: currentRating,
            newAverageRating: roundedRating,
            totalReviews: newTotalReviews,
            reviewId
         };
      } catch (error) {
         console.error('Failed to update restaurant rating:', error);
         throw new Error(`Failed to update restaurant rating: ${error instanceof Error ? error.message : error}`);
      }
   }

   async deleteRestaurant(id: string) {
      const existingRestaurant = await this.getRestaurantById(id);

      await this.db.delete(restaurant)
         .where(eq(restaurant.id, id));

      return { name: existingRestaurant.name, id: existingRestaurant.id };
   }

   async getOwnerRestaurants(ownerId: string) {
      return await this.db.select()
         .from(restaurant)
         .where(eq(restaurant.ownerId, ownerId));
   }

   async getRestaurantMenu(restaurantId: string) {
      // verify restaurant exists
      const restaurant = await this.getRestaurantById(restaurantId);

      // get categories with items
      const categories = await this.db.select({
         id: menuCategories.id,
         category: menuCategories.name,
         description: menuCategories.description,
         sortOrder: menuCategories.sortOrder
      })
         .from(menuCategories)
         .where(and(
            eq(menuCategories.restaurantId, restaurantId),
            eq(menuCategories.isActive, true)
         ))
         .orderBy(menuCategories.sortOrder);

      const menu = [];

      for (const category of categories) {
         const menus = await this.db.select({
            id: menuItems.id,
            name: menuItems.name,
            description: menuItems.description,
            price: menuItems.price,
            preparationTime: menuItems.preparationTime
         })
            .from(menuItems)
            .where(and(
               eq(menuItems.categoryId, category.id),
               eq(menuItems.isAvailable, true)
            ));

         menu.push({
            ...category,
            menus
         });
      }

      return { restaurant: restaurant.name, menu };
   }

   async getMenuCategory(restaurantId: any) {
      const existingRestaurant = await this.getRestaurantById(restaurantId);

      const categories = await this.db.select({
         id: menuCategories.id,
         name: menuCategories.name,
         sortOder: menuCategories.sortOrder
      })
         .from(menuCategories)
         .where(eq(menuCategories.restaurantId, existingRestaurant.id));

      return {
         restaurant: existingRestaurant.name,
         categories
      }
   }

   async createMenuCategory(data: any, user: any) {
      // verify user owns the restaurant
      const existingRestaurant = await this.getRestaurantById(data.restaurantId);

      if (user.role !== 'admin' && existingRestaurant.ownerId !== user.sub) {
         throw new Error('You do not have permission to add categories to this restaurant');
      }

      const [category] = await this.db.insert(menuCategories)
         .values({
            restaurantId: data.restaurantId,
            name: data.name,
            description: data.description,
            sortOrder: data.sortOrder || 0,
            isActive: true
         })
         .returning();

      return category;
   }

   async getMenuItemById(itemId: string) {
      const [item] = await this.db.select()
         .from(menuItems)
         .where(eq(menuItems.id, itemId))
         .limit(1);

      if (!item) {
         throw new Error('Menu item not found');
      }

      return item;
   }

   async createMenuItem(data: any, user: any) {
      // verify user owns the restaurant
      const existingRestaurant = await this.getRestaurantById(data.restaurantId);

      if (user.role !== 'admin' && existingRestaurant.ownerId !== user.sub) {
         throw new Error('You do not have permission to add categories to this restaurant');
      }

      const [item] = await this.db.insert(menuItems)
         .values({
            restaurantId: data.restaurantId,
            categoryId: data.categoryId,
            name: data.name,
            description: data.description,
            price: data.price,
            isAvailable: true,
            preparationTime: data.preparationTime || 5,
            createdAt: new Date()
         })
         .returning();

      return item;
   }

   async updateMenuItem(itemId: string, data: any, user: any) {
      // get item and verify ownership
      const [item] = await this.db.select({
         id: menuItems.id,
         restaurantId: menuItems.restaurantId
      })
         .from(menuItems)
         .where(eq(menuItems.id, itemId))
         .limit(1);

      if (!item) {
         throw new Error('Menu item not found');
      }

      const existingRestaurant = await this.getRestaurantById(data.restaurantId);

      if (user.role !== 'admin' && existingRestaurant.ownerId !== user.sub) {
         throw new Error('You do not have permission to add categories to this restaurant');
      }

      const [updatedItem] = await this.db.update(menuItems)
         .set({ ...data, updatedAt: new Date() })
         .where(eq(menuItems.id, itemId))
         .returning();

      return updatedItem;
   }

   async deleteMenuItem(itemId: string, user: any) {
      // get item and verify ownership
      const [item] = await this.db.select({
         id: menuItems.id,
         restaurantId: menuItems.restaurantId,
         name: menuItems.name
      })
         .from(menuItems)
         .where(eq(menuItems.id, itemId))
         .limit(1);

      if (!item) {
         throw new Error('Menu item not found');
      }

      const existingRestaurant = await this.getRestaurantById(item.restaurantId!);

      if (user.role !== 'admin' && existingRestaurant.ownerId !== user.sub) {
         throw new Error('You do not have permission to add categories to this restaurant');
      }

      await this.db.delete(menuItems)
         .where(eq(menuItems.id, itemId));

      return { name: item.name, id: item.id };
   }
}