import { describe, it, expect, beforeEach, mock, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';

describe('Auth Routes', () => {
   let mockAuthServiceInstance: any;
   let MockAuthServiceConstructor: any;
   let authRoutes: any;
   let app: any;
   let mockDb: any;
   let mockJwt: any;

   beforeAll(async () => {
      mockAuthServiceInstance = {
         register: mock(),
         login: mock(),
         createSession: mock(),
         retryStripeAccountCreation: mock(),
         getOnboardingStatus: mock(),
         deleteUserSessions: mock()
      };

      // mock constructor
      MockAuthServiceConstructor = mock(() => mockAuthServiceInstance);

      // mock module
      mock.module('../../src/services/auth.service', () => ({
         AuthService: MockAuthServiceConstructor
      }));

      // import the routes after mocking
      const routeModule = await import('../../src/routes/auth.route');
      authRoutes = routeModule.authRoutes;
   });

   beforeEach(() => {
      // reset all mocks
      mockAuthServiceInstance.register.mockReset();
      mockAuthServiceInstance.login.mockReset();
      mockAuthServiceInstance.createSession.mockReset();
      mockAuthServiceInstance.retryStripeAccountCreation.mockReset();
      mockAuthServiceInstance.getOnboardingStatus.mockReset();
      mockAuthServiceInstance.deleteUserSessions.mockReset();
      MockAuthServiceConstructor.mockReset();

      // setup construstor to return the mock instance
      MockAuthServiceConstructor.mockReturnValue(mockAuthServiceInstance);

      // Create mocks
      mockDb = {
         select: mock(),
         insert: mock(),
         update: mock(),
         delete: mock()
      };

      mockJwt = {
         sign: mock(() => Promise.resolve('jwt-token-123'))
      };

      // Create test app with mocked AuthService
      app = new Elysia()
         .decorate('db', mockDb)
         .decorate('jwt', mockJwt)
         .use(authRoutes);
   });

   afterAll(() => {
      mock.restore();
   });

   describe('POST /api/auth/register', () => {
      const validRegisterData = {
         email: 'test@example.com',
         password: 'password123',
         phone: '1234567890',
         fullName: 'Test User',
         role: 'customer'
      };

      it('should register user successfully', async () => {
         // Mock AuthService register method - RETURN SUCCESSFUL RESULT
         mockAuthServiceInstance.register.mockResolvedValueOnce({
            id: 'user-123',
            email: 'test@example.com',
            fullName: 'Test User',
            role: 'customer'
         });

         // Mock createSession method
         mockAuthServiceInstance.createSession.mockResolvedValueOnce({});

         const response = await app
            .handle(new Request('http://localhost/api/auth/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(validRegisterData)
            }));

         expect(response.status).toBe(201);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.message).toBe('Registration successfull');
         expect(body.data.user).toBeDefined();
         expect(body.data.token).toBeDefined();
      });

      it('should handle email already registered error', async () => {
         // Mock AuthService register method to throw error
         mockAuthServiceInstance.register.mockRejectedValueOnce(new Error('Email already registered'));

         const response = await app
            .handle(new Request('http://localhost/api/auth/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(validRegisterData)
            }));

         expect(response.status).toBe(409);

         const body = await response.json();
         expect(body).toEqual({
            success: false,
            message: 'Email already registered'
         });
      });

      it('should validate required fields', async () => {
         const invalidData = {
            email: 'invalid-email',
            password: '123', // too short
            phone: '123', // too short
            fullName: 'A' // too short
         };

         const response = await app
            .handle(new Request('http://localhost/api/auth/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(invalidData)
            }));

         expect(response.status).toBe(422); // Elysia validation returns 422
      });

      it('should validate role enum', async () => {
         const invalidRoleData = {
            ...validRegisterData,
            role: 'invalid_role'
         };

         const response = await app
            .handle(new Request('http://localhost/api/auth/register', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(invalidRoleData)
            }));

         expect(response.status).toBe(422); // Elysia validation returns 422
      });
   });

   describe('POST /api/auth/login', () => {
      const validLoginData = {
         email: 'test@example.com',
         password: 'password123'
      };

      it('should login user successfully', async () => {
         // Mock AuthService login method - RETURN SUCCESSFUL RESULT
         mockAuthServiceInstance.login.mockResolvedValueOnce({
            id: 'user-123',
            email: 'test@example.com',
            role: 'customer',
            fullName: 'Test User',
            phone: '1234567890',
            address: null,
            status: 'active'
         });

         // Mock createSession method
         mockAuthServiceInstance.createSession.mockResolvedValueOnce({});

         const response = await app
            .handle(new Request('http://localhost/api/auth/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(validLoginData)
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.message).toBe('Login successfull');
         expect(body.data.user).toBeDefined();
         expect(body.data.token).toBeDefined();
      });

      it('should handle invalid credentials', async () => {
         // Mock AuthService login method to throw error
         mockAuthServiceInstance.login.mockRejectedValueOnce(new Error('Invalid password'));

         const response = await app
            .handle(new Request('http://localhost/api/auth/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(validLoginData)
            }));

         expect(response.status).toBe(401);

         const body = await response.json();
         expect(body).toEqual({
            success: false,
            message: 'Invalid password'
         });
      });

      it('should validate email format', async () => {
         const invalidEmailData = {
            email: 'invalid-email',
            password: 'password123'
         };

         const response = await app
            .handle(new Request('http://localhost/api/auth/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(invalidEmailData)
            }));

         expect(response.status).toBe(422); // Elysia validation returns 422
      });

      it('should require password field', async () => {
         const missingPasswordData = {
            email: 'test@example.com'
         };

         const response = await app
            .handle(new Request('http://localhost/api/auth/login', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(missingPasswordData)
            }));

         expect(response.status).toBe(422); // Elysia validation returns 422
      });
   });

   describe('GET /api/auth/profile', () => {
      const mockHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'customer',
         'x-user-email': 'test@example.com'
      };

      it('should get user profile successfully', async () => {
         const response = await app
            .handle(new Request('http://localhost/api/auth/profile', {
               method: 'GET',
               headers: mockHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.data.user).toEqual({
            id: 'user-123',
            email: 'test@example.com',
            role: 'customer'
         });
         // Customer role tidak punya stripe data
      });

      it('should get restaurant_owner profile with Stripe status', async () => {
         const restaurantHeaders = {
            'x-user-id': 'user-123',
            'x-user-role': 'restaurant_owner',
            'x-user-email': 'restaurant@example.com'
         };

         // Mock getOnboardingStatus method
         mockAuthServiceInstance.getOnboardingStatus.mockResolvedValueOnce({
            hasStripeAccount: true,
            onboardingRequired: false,
            onboardingCompleted: true
         });

         const response = await app
            .handle(new Request('http://localhost/api/auth/profile', {
               method: 'GET',
               headers: restaurantHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.data.user).toEqual({
            id: 'user-123',
            email: 'restaurant@example.com',
            role: 'restaurant_owner'
         });
         expect(body.data.stripe).toBeDefined();
      });

      it('should handle missing authentication headers', async () => {
         const response = await app
            .handle(new Request('http://localhost/api/auth/profile', {
               method: 'GET'
            }));

         expect(response.status).toBe(401);
      });
   });

   describe('POST /api/auth/retry-stripe-account', () => {
      const mockHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'restaurant_owner',
         'x-user-email': 'restaurant@example.com'
      };

      const validRetryData = {
         businessName: 'New Restaurant',
         country: 'SG'
      };

      it('should retry Stripe account creation successfully', async () => {
         // Mock retryStripeAccountCreation method - RETURN SUCCESSFUL RESULT
         mockAuthServiceInstance.retryStripeAccountCreation.mockResolvedValueOnce({
            accountId: 'acct_123',
            onboardingUrl: 'https://connect.stripe.com/setup/s/...'
         });

         const response = await app
            .handle(new Request('http://localhost/api/auth/retry-stripe-account', {
               method: 'POST',
               headers: {
                  ...mockHeaders,
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(validRetryData)
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.message).toBe('Stripe account created successfully');
      });

      it('should handle user already has Stripe account', async () => {
         // Mock retryStripeAccountCreation method to throw correct error
         mockAuthServiceInstance.retryStripeAccountCreation.mockRejectedValueOnce(new Error('User already has a Stripe account'));

         const response = await app
            .handle(new Request('http://localhost/api/auth/retry-stripe-account', {
               method: 'POST',
               headers: {
                  ...mockHeaders,
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify(validRetryData)
            }));

         expect(response.status).toBe(400);

         const body = await response.json();
         expect(body.success).toBe(false);
         expect(body.message).toBe('User already has a Stripe account');
      });

      it('should handle missing authentication', async () => {
         const response = await app
            .handle(new Request('http://localhost/api/auth/retry-stripe-account', {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(validRetryData)
            }));

         expect(response.status).toBe(401);
      });
   });

   describe('GET /api/auth/stripe-status', () => {
      const mockHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'restaurant_owner',
         'x-user-email': 'restaurant@example.com'
      };

      it('should get Stripe status successfully', async () => {
         // Mock getOnboardingStatus method
         mockAuthServiceInstance.getOnboardingStatus.mockResolvedValueOnce({
            hasStripeAccount: true,
            onboardingRequired: false,
            onboardingCompleted: true,
            accountStatus: {
               charges_enabled: true,
               payouts_enabled: true
            }
         });

         const response = await app
            .handle(new Request('http://localhost/api/auth/stripe-status', {
               method: 'GET',
               headers: mockHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.data).toBeDefined();
      });

      it('should handle user without Stripe account', async () => {
         // Mock getOnboardingStatus method
         mockAuthServiceInstance.getOnboardingStatus.mockResolvedValueOnce({
            hasStripeAccount: false,
            onboardingRequired: true,
            onboardingCompleted: false
         });

         const response = await app
            .handle(new Request('http://localhost/api/auth/stripe-status', {
               method: 'GET',
               headers: mockHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body.success).toBe(true);
         expect(body.data.hasStripeAccount).toBe(false);
      });

      it('should handle missing authentication', async () => {
         const response = await app
            .handle(new Request('http://localhost/api/auth/stripe-status', {
               method: 'GET'
            }));

         expect(response.status).toBe(401);
      });
   });

   describe('DELETE /api/auth/logout', () => {
      const mockHeaders = {
         'x-user-id': 'user-123',
         'x-user-role': 'customer',
         'x-user-email': 'test@example.com'
      };

      it('should logout user successfully', async () => {
         // Mock deleteUserSessions method
         mockAuthServiceInstance.deleteUserSessions.mockResolvedValueOnce({});

         const response = await app
            .handle(new Request('http://localhost/api/auth/logout', {
               method: 'DELETE',
               headers: mockHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         expect(body).toEqual({
            success: true,
            message: 'Logged out successfully'
         });
      });

      it('should handle logout with database error gracefully', async () => {
         // Mock deleteUserSessions method to throw error
         mockAuthServiceInstance.deleteUserSessions.mockRejectedValueOnce(new Error('Database error'));

         const response = await app
            .handle(new Request('http://localhost/api/auth/logout', {
               method: 'DELETE',
               headers: mockHeaders
            }));

         expect(response.status).toBe(200);

         const body = await response.json();
         // Based on your route implementation, it returns success: false when error occurs
         expect(body).toEqual({
            success: false,
            message: 'Logout failed'
         });
      });

      it('should handle missing authentication', async () => {
         const response = await app
            .handle(new Request('http://localhost/api/auth/logout', {
               method: 'DELETE'
            }));

         expect(response.status).toBe(401);
      });
   });
});