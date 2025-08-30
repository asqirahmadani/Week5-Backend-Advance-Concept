import { users, type User } from '../db/schema.ts';
import { sanitizeUser } from '../middleware/sanitize';
import { db, type Database } from '../db/client.ts';
import { and, eq, sql } from 'drizzle-orm';
import { hash } from 'bcrypt';

interface AvailableDriver {
   fullName: string;
   phone: string | null;
   status: "active" | "inactive" | "suspended" | null;
}

export class UserService {
   private db: Database;

   constructor(private injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
   }

   async getUserById(id: string): Promise<User> {
      try {
         const [user] = await this.db.select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
         if (!user) throw new Error('User not found');
         return sanitizeUser(user);
      } catch (error) {
         console.error('Error in getUserById:', error);
         throw error;
      }
   }

   async getUserByEmail(email: string): Promise<User> {
      try {
         const [user] = await this.db.select()
            .from(users)
            .where(and(
               eq(users.email, email),
               eq(users.status, 'active')
            ))
            .limit(1);
         return user;
      } catch (error) {
         console.error('Error in getUserByEmail:', error);
         throw error;
      }
   }

   async getAllUsers(page: number = 1, limit: number = 10) {
      const offset = (page - 1) * limit;

      const userList = await this.db.select({
         id: users.id,
         email: users.email,
         fullName: users.fullName,
         role: users.role,
         phone: users.phone,
         status: users.status,
         created_at: users.createdAt
      })
         .from(users)
         .limit(limit)
         .offset(offset)

      return userList;
   }

   async getAvailableDriver(): Promise<AvailableDriver[]> {
      try {
         const drivers = await this.db.select({
            fullName: users.fullName,
            phone: users.phone,
            status: users.status
         })
            .from(users)
            .where(
               and(
                  eq(users.role, 'driver'),
                  eq(users.status, 'active')
               )
            )
         return drivers;
      } catch (error) {
         console.error('Error in getAvailableDriver:', error);
         throw error;
      }
   }

   async updateUser(id: string, userData: any) {
      try {
         // Check if user exists first
         const existingUser = await this.getUserById(id);
         if (!existingUser) {
            throw new Error('User not found');
         }

         if (userData.password) {
            userData.password = await hash(userData.password, 10);
         }

         if (userData.email) {
            const exist = await this.getUserByEmail(userData.email);
            if (exist) {
               throw new Error('Email already used');
            }
         }

         const updatedUser = await this.db.update(users)
            .set({ ...userData, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();

         if (!updatedUser.length) {
            console.warn(`User not found with ID: ${id}`);
            throw new Error('User not found');
         }

         return updatedUser;
      } catch (error: any) {
         if (error.message === 'Email already used' ||
            error.message === 'User not found') {
            throw error; // Re-throw validation errors as-is
         }

         // Only catch and wrap unexpected errors
         console.error('Unexpected error in updateUser:', error);
         throw new Error('Failed to update user');
      }
   }

   async getUsersCount(): Promise<number> {
      try {
         const [{ count }] = await this.db.select({
            count: sql<number>`count(*)`
         }).from(users);
         return count;
      } catch (error) {
         console.error('Error in getUsersCount:', error);
         throw error;
      }
   }

   async deleteUser(id: string) {
      try {
         const deletedUser = await this.getUserById(id);
         await this.db.delete(users).where(eq(users.id, id)).returning();
         return { name: deletedUser.fullName, role: deletedUser.role };
      } catch (error) {
         console.error('Error in deleteUser:', error);
         throw new Error('Failed to delete user');
      }
   }
}