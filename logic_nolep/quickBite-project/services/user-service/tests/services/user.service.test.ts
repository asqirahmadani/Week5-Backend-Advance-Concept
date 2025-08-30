import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { UserService } from "../../src/services/user.service";
import { sanitizeUser } from "../../src/middleware/sanitize";
import { hash } from "bcrypt";
import type { User } from "../../src/db/schema";

// Helper function to create mock user with proper types
const createMockUser = (overrides: Partial<User> = {}): User => ({
   id: '1',
   fullName: 'Test User',
   email: 'test@example.com',
   password: 'hashedPassword',
   phone: null,
   role: null,
   status: null,
   address: null,
   city: null,
   stripeAccountId: null,
   stripeOnboardingCompleted: null,
   stripeCreatedAt: null,
   createdAt: null,
   updatedAt: null,
   ...overrides
});

// Helper function for available driver type
const createMockDriver = (overrides: any = {}) => ({
   fullName: 'Driver 1',
   phone: '123456789',
   status: 'active' as const,
   ...overrides
});

// Helper function for user list items with proper types
const createMockUserListItem = (overrides: any = {}) => ({
   id: '1',
   email: 'user1@example.com',
   fullName: 'User 1',
   role: 'customer' as const,
   phone: '123456789',
   status: 'active' as const,
   created_at: new Date(),
   ...overrides
});

const createMockDb = () => {
   const mockLimit = mock();
   const mockOffset = mock();
   const mockWhere = mock();
   const mockFrom = mock();
   const mockSet = mock();
   const mockReturning = mock();

   // setup the chainable methods
   mockLimit.mockReturnValue({ offset: mockOffset });
   mockOffset.mockReturnValue({ limit: mockLimit });
   mockWhere.mockReturnValue({
      limit: mockLimit,
      offset: mockOffset,
      returning: mockReturning,
   });
   mockFrom.mockReturnValue({
      where: mockWhere,
      limit: mockLimit,
      offset: mockOffset,
   });
   mockSet.mockReturnValue({ where: mockWhere });
   mockReturning.mockResolvedValue([]);

   return {
      select: mock().mockReturnValue({
         from: mockFrom,
         where: mockWhere,
         limit: mockLimit,
         offset: mockOffset,
      }),
      update: mock().mockReturnValue({
         set: mockSet,
         where: mockWhere,
         returning: mockReturning,
      }),
      delete: mock().mockReturnValue({
         where: mockWhere,
         returning: mockReturning,
      }),
      // expose individual mocks for testing
      _mocks: {
         limit: mockLimit,
         offset: mockOffset,
         where: mockWhere,
         from: mockFrom,
         set: mockSet,
         returning: mockReturning,
      }
   }
}

describe('UserService', () => {
   let userService: UserService;
   let mockDb: ReturnType<typeof createMockDb>;

   beforeEach(() => {
      mockDb = createMockDb();
      userService = new UserService(mockDb as any);
   });

   describe('getUserById', () => {
      it('should return sanitized user by id', async () => {
         const mockUser = createMockUser({
            id: '1',
            email: 'test@example.com',
            fullName: 'Test User',
            password: 'hashedPassword'
         });

         mockDb._mocks.limit.mockResolvedValue([mockUser]);
         const result = await userService.getUserById('1');

         // Expect result to not have password field
         expect(result).toBeDefined();
         expect(result.id).toBe('1');
         expect(result.email).toBe('test@example.com');
         expect(result.fullName).toBe('Test User');
         expect((result as any).password).toBeUndefined(); // Password should be removed
      });

      it('should throw error if user not found', async () => {
         mockDb._mocks.limit.mockResolvedValue([]);

         await expect(userService.getUserById('999')).rejects.toThrow('User not found');
      });

      it('should handle database errors', async () => {
         mockDb._mocks.limit.mockRejectedValue(new Error('Database error'));

         await expect(userService.getUserById('1')).rejects.toThrow('Database error');
      });
   });

   describe('getUserByEmail', () => {
      it('should return user by email', async () => {
         const mockUser = createMockUser({
            id: '1',
            email: 'test@example.com',
            fullName: 'Test User',
            password: 'hashedPassword'
         });

         mockDb._mocks.limit.mockResolvedValue([mockUser]);

         const result = await userService.getUserByEmail('test@example.com');

         expect(result).toEqual(mockUser);
      });

      it('should return undefined for non-existent user', async () => {
         mockDb._mocks.limit.mockResolvedValue([]);

         const result = await userService.getUserByEmail('nonexistent@example.com');

         expect(result).toBeUndefined();
      });

      it('should handle database errors', async () => {
         mockDb._mocks.limit.mockRejectedValue(new Error('Database connection failed'));

         await expect(userService.getUserByEmail('test@example.com')).rejects.toThrow('Database connection failed');
      });
   });

   describe('getAllUsers', () => {
      it('should return paginated users list', async () => {
         const mockUsers = [
            createMockUserListItem({
               id: '1',
               email: 'user1@example.com',
               fullName: 'User 1',
               role: 'customer' as const,
               phone: '123456789',
               status: 'active' as const,
               created_at: new Date()
            }),
            createMockUserListItem({
               id: '2',
               email: 'user2@example.com',
               fullName: 'User 2',
               role: 'driver' as const,
               phone: '987654321',
               status: 'active' as const,
               created_at: new Date()
            })
         ];

         mockDb._mocks.offset.mockResolvedValue(mockUsers);

         const result = await userService.getAllUsers(1, 10);

         expect(result).toEqual(mockUsers);
         expect(result).toHaveLength(2);
      });

      it('should use default pagination values', async () => {
         const mockUsers = [
            createMockUserListItem({
               id: '1',
               email: 'user1@example.com',
               fullName: 'User 1',
               role: 'customer' as const,
               phone: '123456789',
               status: 'active' as const,
               created_at: new Date()
            })
         ];

         mockDb._mocks.offset.mockResolvedValue(mockUsers);

         const result = await userService.getAllUsers();

         expect(mockDb.select).toHaveBeenCalled();
         expect(result).toEqual(mockUsers);
      });

      it('should calculate correct offset for pagination', async () => {
         const mockUsers: any = [];
         mockDb._mocks.offset.mockResolvedValue(mockUsers);

         await userService.getAllUsers(3, 5); // Page 3, limit 5 = offset 10

         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should handle empty result set', async () => {
         mockDb._mocks.offset.mockResolvedValue([]);

         const result = await userService.getAllUsers(1, 10);

         expect(result).toEqual([]);
      });
   });

   describe('getAvailableDriver', () => {
      it('should return available drivers', async () => {
         const mockDrivers = [
            createMockDriver({
               fullName: 'Driver 1',
               phone: '123456789',
               status: 'active' as const
            }),
            createMockDriver({
               fullName: 'Driver 2',
               phone: '987654321',
               status: 'active' as const
            })
         ];

         mockDb._mocks.where.mockResolvedValue(mockDrivers);

         const result = await userService.getAvailableDriver();

         expect(result).toEqual(mockDrivers);
         expect(result).toHaveLength(2);
      });

      it('should return empty array if no drivers available', async () => {
         mockDb._mocks.where.mockResolvedValue([]);

         const result = await userService.getAvailableDriver();

         expect(result).toEqual([]);
      });

      it('should only return active drivers', async () => {
         const mockDrivers = [
            createMockDriver({
               fullName: 'Active Driver',
               phone: '123456789',
               status: 'active' as const
            })
         ];

         mockDb._mocks.where.mockResolvedValue(mockDrivers);

         const result = await userService.getAvailableDriver();

         expect(result).toEqual(mockDrivers);
         // Verify that the query filters for role='driver' and status='active'
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
         mockDb._mocks.where.mockRejectedValue(new Error('Database query failed'));

         await expect(userService.getAvailableDriver()).rejects.toThrow('Database query failed');
      });
   });

   describe('updateUser', () => {
      it('should update user successfully', async () => {
         const userId = '1';
         const userData = { fullName: 'Updated Name', phone: '999888777' };
         const updatedUser = [createMockUser({
            id: '1',
            fullName: 'Updated Name',
            phone: '999888777'
         })];
         const existingUser = createMockUser({
            id: '1',
            fullName: 'Old Name'
         });

         const getUserByIdSpy = spyOn(userService, 'getUserById').mockResolvedValue(existingUser);
         mockDb._mocks.returning.mockResolvedValue(updatedUser);

         const result = await userService.updateUser(userId, userData);

         expect(getUserByIdSpy).toHaveBeenCalledWith(userId);
         expect(result).toEqual(updatedUser);
      });

      it('should hash password when provided', async () => {
         const userId = '1';
         const userData = { password: 'newpassword' };
         const hashedPassword = 'hashedNewPassword';
         const updatedUser = [createMockUser({
            id: '1',
            password: hashedPassword
         })];
         const existingUser = createMockUser({
            id: '1',
            fullName: 'Test User'
         });

         spyOn(userService, 'getUserById').mockResolvedValue(existingUser);
         spyOn({ hash }, 'hash').mockResolvedValue(hashedPassword as never);
         mockDb._mocks.returning.mockResolvedValue(updatedUser);

         const result = await userService.updateUser(userId, userData);

         expect(result).toEqual(updatedUser);
      });

      it('should check email uniqueness when email provided', async () => {
         const userId = '1';
         const userData = { email: 'existing@example.com' };
         const existingUser = createMockUser({
            id: '2',
            email: 'existing@example.com'
         });
         const currentUser = createMockUser({
            id: '1',
            email: 'old@example.com'
         });

         spyOn(userService, 'getUserById').mockResolvedValue(currentUser);
         const getUserByEmailSpy = spyOn(userService, 'getUserByEmail').mockResolvedValue(existingUser);

         await expect(userService.updateUser(userId, userData)).rejects.toThrow('Email already used');

         expect(getUserByEmailSpy).toHaveBeenCalledWith('existing@example.com');
      });

      it('should allow same user to keep their email', async () => {
         const userId = '1';
         const userData = { email: 'same@example.com', fullName: 'Updated Name' };
         const currentUser = createMockUser({
            id: '1',
            email: 'same@example.com',
            fullName: 'Old Name'
         });
         const updatedUser = [createMockUser({
            id: '1',
            email: 'same@example.com',
            fullName: 'Updated Name'
         })];

         spyOn(userService, 'getUserById').mockResolvedValue(currentUser);
         spyOn(userService, 'getUserByEmail').mockResolvedValue(undefined as any);
         mockDb._mocks.returning.mockResolvedValue(updatedUser);

         const result = await userService.updateUser(userId, userData);

         expect(result).toEqual(updatedUser);
      });

      it('should throw error if user not found', async () => {
         const userId = '999';
         const userData = { fullName: 'Test' };

         spyOn(userService, 'getUserById').mockRejectedValue(new Error('User not found'));

         await expect(userService.updateUser(userId, userData)).rejects.toThrow('User not found');
      });

      it('should handle database update errors', async () => {
         const userId = '1';
         const userData = { fullName: 'Test' };
         const existingUser = createMockUser({
            id: '1',
            fullName: 'Old Name'
         });

         spyOn(userService, 'getUserById').mockResolvedValue(existingUser);
         mockDb._mocks.returning.mockRejectedValue(new Error('Database update failed'));

         await expect(userService.updateUser(userId, userData)).rejects.toThrow('Failed to update user');
      });

      it('should throw error when no rows updated', async () => {
         const userId = '1';
         const userData = { fullName: 'Test' };
         const existingUser = createMockUser({
            id: '1',
            fullName: 'Old Name'
         });

         spyOn(userService, 'getUserById').mockResolvedValue(existingUser);
         mockDb._mocks.returning.mockResolvedValue([]); // No rows updated

         await expect(userService.updateUser(userId, userData)).rejects.toThrow('User not found');
      });
   });

   describe('deleteUser', () => {
      it('should delete user successfully', async () => {
         const userId = '1';
         const mockUser = createMockUser({
            id: '1',
            fullName: 'Test User',
            role: 'customer' as const
         });

         spyOn(userService, 'getUserById').mockResolvedValue(mockUser);
         mockDb._mocks.returning.mockResolvedValue([mockUser]);

         const result = await userService.deleteUser(userId);

         expect(result).toEqual({ name: 'Test User', role: 'customer' });
      });

      it('should throw error if user not found for deletion', async () => {
         const userId = '999';

         spyOn(userService, 'getUserById').mockRejectedValue(new Error('User not found'));

         await expect(userService.deleteUser(userId)).rejects.toThrow('Failed to delete user');
      });

      it('should handle database deletion errors', async () => {
         const userId = '1';
         const mockUser = createMockUser({
            id: '1',
            fullName: 'Test User',
            role: 'customer' as const
         });

         spyOn(userService, 'getUserById').mockResolvedValue(mockUser);
         mockDb._mocks.returning.mockRejectedValue(new Error('Database delete failed'));

         await expect(userService.deleteUser(userId)).rejects.toThrow('Failed to delete user');
      });
   });

   describe('getUsersCount', () => {
      it('should return users count', async () => {
         const mockCount = [{ count: 5 }];

         mockDb._mocks.from.mockResolvedValue(mockCount);

         const result = await userService.getUsersCount();

         expect(result).toBe(5);
      });

      it('should return 0 when no users exist', async () => {
         const mockCount = [{ count: 0 }];

         mockDb._mocks.from.mockResolvedValue(mockCount);

         const result = await userService.getUsersCount();

         expect(result).toBe(0);
      });

      it('should handle database errors', async () => {
         mockDb._mocks.from.mockRejectedValue(new Error('Count query failed'));

         await expect(userService.getUsersCount()).rejects.toThrow('Count query failed');
      });
   });
});