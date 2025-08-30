import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AuthService } from '../../src/services/auth.service';
import * as bcrypt from 'bcryptjs';

// Create mock functions for bcrypt
const mockBcryptHash = mock(() => Promise.resolve('hashedPassword'));
const mockBcryptCompare = mock(() => Promise.resolve(true));

// Mock the bcrypt module
mock.module('bcryptjs', () => ({
   hash: mockBcryptHash,
   compare: mockBcryptCompare,
   default: {
      hash: mockBcryptHash,
      compare: mockBcryptCompare
   }
}));

const createMockDb = () => {
   const mockLimit = mock();
   const mockWhere = mock();
   const mockFrom = mock();
   const mockValues = mock();
   const mockSet = mock();
   const mockReturning = mock();

   // Setup method chaining
   mockWhere.mockReturnValue({
      limit: mockLimit,
      returning: mockReturning
   });
   mockFrom.mockReturnValue({
      where: mockWhere,
      limit: mockLimit
   });
   mockValues.mockReturnValue({
      returning: mockReturning
   });
   mockSet.mockReturnValue({
      where: mockWhere
   });

   return {
      select: mock().mockReturnValue({
         from: mockFrom,
         where: mockWhere,
         limit: mockLimit
      }),
      insert: mock().mockReturnValue({
         values: mockValues,
         returning: mockReturning
      }),
      update: mock().mockReturnValue({
         set: mockSet,
         where: mockWhere
      }),
      delete: mock().mockReturnValue({
         where: mockWhere
      }),
      _mocks: {
         limit: mockLimit,
         where: mockWhere,
         from: mockFrom,
         values: mockValues,
         set: mockSet,
         returning: mockReturning
      }
   };
};

describe('AuthService', () => {
   let authService: AuthService;
   let mockDb: ReturnType<typeof createMockDb>;
   let mockUserService: any;
   let mockStripeConnectService: any;

   beforeEach(() => {
      // Reset all mocks
      mockBcryptHash.mockClear();
      mockBcryptHash.mockClear();

      mockDb = createMockDb();
      mockUserService = {
         getUserByEmail: mock(),
         getUserById: mock(),
         getAllUsers: mock(),
         getAvailableDriver: mock(),
         updateUser: mock(),
         getUsersCount: mock(),
         deleteUser: mock()
      };

      mockStripeConnectService = {
         createRestaurantAccount: mock(),
         createDriverAccount: mock(),
         getAccountStatus: mock(),
         createOnboardingLink: mock(),
         updateAccount: mock(),
         createTransfer: mock(),
         getAccountBalance: mock(),
         listTransfers: mock(),
         deleteAccount: mock(),
         createLoginLink: mock(),
         verifyWebHookSignature: mock(),
         getAccountRequirements: mock(),
         canReceivePayments: mock(),
         canReceivePayouts: mock()
      };

      authService = new AuthService(mockDb as any, mockUserService, mockStripeConnectService);
   });

   describe('register', () => {
      const mockUserData = {
         email: 'test@example.com',
         password: 'password123',
         phone: '1234567890',
         fullName: 'Test User',
         role: 'customer' as const
      };

      it('should register a new customer successfully', async () => {
         const hashedPassword = 'hashedPassword123';
         const newUser = {
            id: 'user-123',
            fullName: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            phone: '1234567890',
            role: 'customer' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: null,
            stripeOnboardingCompleted: false,
            stripeCreatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         // Mock no existing user
         mockDb._mocks.limit.mockResolvedValue([]);

         // Mock bcrypt hash
         mockBcryptHash.mockResolvedValueOnce(hashedPassword);

         // Mock insert returning new user
         mockDb._mocks.returning.mockResolvedValue([newUser]);

         const result = await authService.register(mockUserData);

         expect(mockBcryptHash).toHaveBeenCalledWith('password123', 12);
         expect(result).toEqual(newUser);
      });

      it('should register restaurant_owner with Stripe account', async () => {
         const restaurantData = {
            ...mockUserData,
            role: 'restaurant_owner' as const,
            businessName: 'Test Restaurant',
            country: 'SG'
         };

         const hashedPassword = 'hashedPassword123';
         const newUser = {
            id: 'user-123',
            fullName: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            phone: '1234567890',
            role: 'restaurant_owner' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: null,
            stripeOnboardingCompleted: false,
            stripeCreatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         const stripeAccount = {
            accountId: 'acct_test123',
            onboardingUrl: 'https://connect.stripe.com/setup/test',
            account: {} as any // Mock Stripe.Response<Stripe.Account>
         };

         mockDb._mocks.limit.mockResolvedValue([]);
         mockBcryptHash.mockResolvedValueOnce(hashedPassword);
         mockDb._mocks.returning.mockResolvedValue([newUser]);
         mockStripeConnectService.createRestaurantAccount.mockResolvedValue(stripeAccount);

         const result = await authService.register(restaurantData);

         expect(mockStripeConnectService.createRestaurantAccount).toHaveBeenCalledWith({
            email: 'test@example.com',
            businessName: 'Test Restaurant',
            country: 'SG'
         });

         expect(result).toEqual({
            ...newUser,
            stripeAccountId: 'acct_test123',
            onboardingUrl: 'https://connect.stripe.com/setup/test',
            onboardingRequired: true
         });
      });

      it('should register driver with Stripe account', async () => {
         const driverData = {
            ...mockUserData,
            role: 'driver' as const,
            country: 'SG'
         };

         const hashedPassword = 'hashedPassword123';
         const newUser = {
            id: 'user-123',
            email: 'test@example.com',
            fullName: 'Test User',
            password: hashedPassword,
            phone: '1234567890',
            role: 'driver' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: null,
            stripeCreatedAt: null,
            stripeOnboardingCompleted: false,
            createdAt: new Date(),
            updatedAt: null
         };

         const stripeAccount = {
            accountId: 'acct_driver123',
            onboardingUrl: 'https://connect.stripe.com/setup/driver',
            account: {} as any // Mock Stripe.Response<Stripe.Account>
         };

         mockDb._mocks.limit.mockResolvedValue([]);
         mockBcryptHash.mockResolvedValueOnce(hashedPassword);
         mockDb._mocks.returning.mockResolvedValue([newUser]);
         mockStripeConnectService.createDriverAccount.mockResolvedValue(stripeAccount);

         const result = await authService.register(driverData);

         expect(mockStripeConnectService.createDriverAccount).toHaveBeenCalledWith({
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            country: 'SG'
         });

         const expectedResult = {
            id: 'user-123',
            fullName: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            phone: '1234567890',
            role: 'driver' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: 'acct_driver123',
            stripeOnboardingCompleted: false,
            stripeCreatedAt: null,
            createdAt: newUser.createdAt,
            updatedAt: newUser.updatedAt,
            onboardingUrl: 'https://connect.stripe.com/setup/driver',
            onboardingRequired: true
         };

         expect(result).toEqual(expectedResult);
      });

      it('should handle Stripe account creation failure gracefully', async () => {
         const restaurantData = {
            ...mockUserData,
            role: 'restaurant_owner' as const,
            businessName: 'Test Restaurant'
         };

         const hashedPassword = 'hashedPassword123';
         const newUser = {
            id: 'user-123',
            fullName: 'Test User',
            email: 'test@example.com',
            password: hashedPassword,
            phone: '1234567890',
            role: 'restaurant_owner' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: null,
            stripeOnboardingCompleted: false,
            stripeCreatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockDb._mocks.limit.mockResolvedValue([]);
         mockBcryptHash.mockResolvedValueOnce(hashedPassword);
         mockDb._mocks.returning.mockResolvedValue([newUser]);
         mockStripeConnectService.createRestaurantAccount.mockRejectedValue(new Error('Stripe error'));

         const result = await authService.register(restaurantData);

         expect(result).toEqual({
            ...newUser,
            stripeAccountId: null,
            onboardingUrl: null,
            onboardingRequired: true,
            stripeError: 'Stripe account creation failed - can be retried later'
         });
      });

      it('should throw error if email already exists', async () => {
         const existingUser = { id: '1', email: 'test@example.com' };

         mockDb._mocks.limit.mockResolvedValue([existingUser]);

         await expect(authService.register(mockUserData)).rejects.toThrow('Email already registered');
      });
   });

   describe('login', () => {
      it('should login user successfully', async () => {
         const loginUser = {
            id: 'user-123',
            fullName: 'Test User',
            email: 'test@example.com',
            password: 'hashedPassword',
            phone: '1234567890',
            role: 'customer' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: null,
            stripeOnboardingCompleted: false,
            stripeCreatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockUserService.getUserByEmail.mockResolvedValue(loginUser);
         mockBcryptCompare.mockResolvedValueOnce(true);

         const result = await authService.login('test@example.com', 'password123');

         expect(mockUserService.getUserByEmail).toHaveBeenCalledWith('test@example.com');
         expect(result).toEqual({
            ...loginUser,
            onboardingStatus: {}
         });
      });

      it('should login restaurant_owner with Stripe status', async () => {
         const loginUser = {
            id: 'user-123',
            fullName: 'Restaurant Owner',
            email: 'restaurant@example.com',
            password: 'hashedPassword',
            phone: '1234567890',
            role: 'restaurant_owner' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: 'acct_test123',
            stripeOnboardingCompleted: true,
            stripeCreatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
         };

         const stripeStatus = {
            id: 'acct_test123',
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            type: 'express' as const,
            country: 'SG',
            default_currency: 'sgd',
            requirements: {
               currently_due: [],
               eventually_due: [],
               past_due: [],
               pending_verification: []
            },
            capabilities: undefined,
            business_profile: undefined,
            created: Date.now()
         };

         mockUserService.getUserByEmail.mockResolvedValue(loginUser);
         mockBcryptCompare.mockResolvedValueOnce(true);
         mockStripeConnectService.getAccountStatus.mockResolvedValue(stripeStatus);

         const result = await authService.login('restaurant@example.com', 'password123');

         expect(mockStripeConnectService.getAccountStatus).toHaveBeenCalledWith('acct_test123');
         expect(result).toEqual({
            ...loginUser,
            onboardingStatus: stripeStatus
         });
      });

      it('should throw error for invalid credentials', async () => {
         mockUserService.getUserByEmail.mockResolvedValue(null);

         await expect(authService.login('wrong@example.com', 'password')).rejects.toThrow('Invalid credentials');
      });

      it('should throw error for invalid password', async () => {
         const loginUser = {
            id: 'user-123',
            fullName: 'Test User',
            email: 'test@example.com',
            password: 'hashedPassword',
            phone: '1234567890',
            role: 'customer' as const,
            status: 'active' as const,
            address: null,
            city: null,
            stripeAccountId: null,
            stripeOnboardingCompleted: false,
            stripeCreatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date()
         };

         mockUserService.getUserByEmail.mockResolvedValue(loginUser);
         mockBcryptCompare.mockResolvedValueOnce(false);

         await expect(authService.login('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid password');
      });
   });

   describe('createSession', () => {
      it('should create user session successfully', async () => {
         const userId = 'user-123';
         const token = 'jwt-token';
         const tokenHash = 'hashedToken';

         mockBcryptHash.mockResolvedValueOnce(tokenHash);
         mockDb._mocks.returning.mockResolvedValue([{ id: 'session-123' }]);

         await authService.createSession(userId, token);

         expect(mockDb.insert).toHaveBeenCalled();
      });
   });

   describe('retryStripeAccountCreation', () => {
      it('should retry Stripe account creation for restaurant_owner', async () => {
         const userId = 'user-123';
         const userData = { businessName: 'New Restaurant', country: 'SG' };
         const user = {
            id: userId,
            email: 'restaurant@example.com',
            fullName: 'Restaurant Owner',
            role: 'restaurant_owner' as const,
            stripeAccountId: null
         };

         const stripeAccount = {
            accountId: 'acct_new123',
            onboardingUrl: 'https://connect.stripe.com/setup/new',
            account: {} as any // Mock Stripe.Response<Stripe.Account>
         };

         mockUserService.getUserById.mockResolvedValue(user);
         mockStripeConnectService.createRestaurantAccount.mockResolvedValue(stripeAccount);

         const result = await authService.retryStripeAccountCreation(userId, userData);

         expect(mockStripeConnectService.createRestaurantAccount).toHaveBeenCalledWith({
            email: 'restaurant@example.com',
            businessName: 'New Restaurant',
            country: 'SG'
         });
         expect(result).toEqual(stripeAccount);
      });

      it('should throw error if user already has Stripe account', async () => {
         const userId = 'user-123';
         const userData = { businessName: 'Restaurant' };
         const user = {
            id: userId,
            role: 'restaurant_owner' as const,
            stripeAccountId: 'acct_existing123'
         };

         mockUserService.getUserById.mockResolvedValue(user);

         await expect(authService.retryStripeAccountCreation(userId, userData)).rejects.toThrow('User already has a Stripe account');
      });

      it('should throw error for invalid role', async () => {
         const userId = 'user-123';
         const userData = { businessName: 'Restaurant' };
         const user = {
            id: userId,
            role: 'customer' as const,
            stripeAccountId: null
         };

         mockUserService.getUserById.mockResolvedValue(user);

         await expect(authService.retryStripeAccountCreation(userId, userData)).rejects.toThrow('User role does not require Stripe account');
      });
   });

   describe('getOnboardingStatus', () => {
      it('should return status for user without Stripe account', async () => {
         const userId = 'user-123';
         const user = {
            id: userId,
            role: 'restaurant_owner' as const,
            stripeAccountId: null
         };

         mockUserService.getUserById.mockResolvedValue(user);

         const result = await authService.getOnboardingStatus(userId);

         expect(result).toEqual({
            hasStripeAccount: false,
            onboardingRequired: true,
            onboardingCompleted: false
         });
      });

      it('should return status for user with Stripe account', async () => {
         const userId = 'user-123';
         const user = {
            id: userId,
            role: 'restaurant_owner' as const,
            stripeAccountId: 'acct_test123'
         };

         const accountStatus = {
            id: 'acct_test123',
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
            type: 'express' as const,
            country: 'SG',
            default_currency: 'sgd',
            requirements: {
               currently_due: [],
               eventually_due: [],
               past_due: [],
               pending_verification: []
            },
            capabilities: undefined,
            business_profile: undefined,
            created: Date.now()
         };

         mockUserService.getUserById.mockResolvedValue(user);
         mockStripeConnectService.getAccountStatus.mockResolvedValue(accountStatus);

         const result = await authService.getOnboardingStatus(userId);

         expect(result).toEqual({
            hasStripeAccount: true,
            onboardingRequired: false,
            onboardingCompleted: true,
            accountStatus
         });
      });

      it('should handle Stripe API error gracefully', async () => {
         const userId = 'user-123';
         const user = {
            id: userId,
            role: 'restaurant_owner' as const,
            stripeAccountId: 'acct_test123'
         };

         mockUserService.getUserById.mockResolvedValue(user);
         mockStripeConnectService.getAccountStatus.mockRejectedValue(new Error('Stripe API error'));

         const result = await authService.getOnboardingStatus(userId);

         expect(result).toEqual({
            hasStripeAccount: true,
            onboardingRequired: true,
            onboardingCompleted: false,
            error: 'Failed to check account status'
         });
      });
   });

   describe('deleteUserSessions', () => {
      it('should delete user sessions successfully', async () => {
         const userId = 'user-123';

         await authService.deleteUserSessions(userId);

         expect(mockDb.delete).toHaveBeenCalled();
      });
   });
});