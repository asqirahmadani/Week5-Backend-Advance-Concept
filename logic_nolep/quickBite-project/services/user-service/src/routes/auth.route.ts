import { Elysia, t } from 'elysia';
import type { JWTPayload } from '../type/auth';
import { AuthService } from '../services/auth.service';

const publicRoutes = new Elysia()
   .derive(({ db }: any) => ({
      authService: new AuthService(db)
   }))

   // register
   .post('/register', async ({ body, authService, jwt, set }: any) => {
      try {
         const newUser = await authService.register(body);

         // generate JWT token
         const token = await jwt.sign({
            sub: newUser.id,
            email: newUser.email,
            role: newUser.role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
         });

         // create session
         await authService.createSession(newUser.id, token);

         set.status = 201;
         return {
            success: true,
            message: 'Registration successfull',
            data: {
               user: newUser,
               token,
               token_type: 'Bearer',
               expires_in: 7 * 24 * 60 * 60,
               ...(newUser.onboardingUrl && {
                  stripe: {
                     accountId: newUser.stripeAccountId,
                     onBoardingRequired: newUser.onboardingRequired
                  }
               })
            }
         }
      } catch (error: any) {
         set.status = error.message === 'Email already registered' ? 409 : 400
         return {
            success: false,
            message: error.message || 'Registration failed'
         }
      }
   }, {
      body: t.Object({
         email: t.String({ format: 'email' }),
         password: t.String({ minLength: 6 }),
         phone: t.String({ minLength: 10 }),
         fullName: t.String({ minLength: 2 }),
         role: t.Optional(t.Union([
            t.Literal('customer'),
            t.Literal('driver'),
            t.Literal('restaurant_owner'),
            t.Literal('admin')
         ])),
         address: t.Optional(t.String()),
         city: t.Optional(t.String()),
         businessName: t.Optional(t.String()),   // for restaurant_owner
         country: t.Optional(t.String())
      })
   })

   .post('/login', async ({ body, authService, jwt, set }: any) => {
      try {
         const user = await authService.login(body.email, body.password);

         // generate JWT token
         const token = await jwt.sign({
            sub: user.id,
            email: user.email,
            role: user.role,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60)
         });

         // create session
         await authService.createSession(user.id, token);
         return {
            success: true,
            message: 'Login successfull',
            data: {
               user,
               token,
               token_type: 'Bearer',
               expires_in: 7 * 24 * 60 * 60,
               ...(user.onboardingStatus && {
                  stripe: {
                     onboardingStatus: user.onboardingStatus
                  }
               })
            }
         }
      } catch (error: any) {
         set.status = 401
         return {
            success: false,
            message: error.message || 'Login failed'
         }
      }
   }, {
      body: t.Object({
         email: t.String({ format: 'email' }),
         password: t.String()
      })
   })

const protectedRoutes = new Elysia()
   .derive(({ db }: any) => ({
      authService: new AuthService(db)
   }))

   .derive(({ headers, set }: any) => {
      const userId = headers['x-user-id'];
      const userRole = headers['x-user-role'];
      const userEmail = headers['x-user-email'];

      if (!userId) {
         set.status = 401;
         throw new Error('Missing user authentication from gateway');
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

   // Get Profile
   .get('/profile', async ({ user, authService, set }: any) => {
      try {
         let stripeStatus = {};
         if (user.role === 'restaurant_owner' || user.role === 'driver') {
            stripeStatus = await authService.getOnboardingStatus(user.sub);
         }

         return {
            success: true,
            data: {
               user: {
                  id: user.sub,
                  email: user.email,
                  role: user.role
               },
               ...(stripeStatus && { stripe: stripeStatus })
            }
         };
      } catch (error) {
         console.error('Failed to get profile:', error);
         return {
            success: true,
            data: {
               user: {
                  id: user.sub,
                  email: user.email,
                  role: user.role
               }
            }
         };
      }
   })

   .post('/retry-stripe-account', async ({ user, body, authService, set }: any) => {
      try {
         const stripeAccount = await authService.retryStripeAccountCreation(user.sub, body);

         return {
            success: true,
            message: 'Stripe account created successfully',
            data: {
               accountId: stripeAccount.accountId,
               onboardingUrl: stripeAccount.onboardingUrl
            }
         };
      } catch (error: any) {
         set.status = 400;
         return {
            success: false,
            message: error.message || 'Failed to create Stripe account'
         };
      }
   }, {
      body: t.Object({
         businessName: t.Optional(t.String()),
         country: t.Optional(t.String())
      })
   })

   .get('/stripe-status', async ({ user, authService, set }: any) => {
      try {
         const status = await authService.getOnboardingStatus(user.sub);
         return {
            success: true,
            data: status
         };
      } catch (error: any) {
         set.status = 400;
         return {
            success: false,
            message: error.message || 'Failed to get Stripe status'
         };
      }
   })


   // Logout
   .delete('/logout', async ({ user, authService }) => {
      try {
         await authService.deleteUserSessions(user.sub);

         return {
            success: true,
            message: 'Logged out successfully'
         }
      } catch (error: any) {
         return {
            success: false,
            message: 'Logout failed'
         }
      }
   })

export const authRoutes = new Elysia({ prefix: '/api/auth' })
   .use(publicRoutes)
   .use(protectedRoutes);