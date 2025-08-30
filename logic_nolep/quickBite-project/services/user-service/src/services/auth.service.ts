import { StripeConnectService } from './stripe-connect.service';
import { userSession, users } from '../db/schema';
import { db, type Database } from '../db/client';
import { UserService } from './user.service';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export class AuthService {
   private stripeConnectService: StripeConnectService;
   private userService: UserService;
   private db: Database;

   constructor(
      private injectedDatabase?: Database,
      private injectedUserService?: UserService,
      private injectedStripeConnectService?: StripeConnectService
   ) {
      this.db = injectedDatabase || db;
      this.userService = injectedUserService || new UserService(this.db);
      this.stripeConnectService = injectedStripeConnectService || new StripeConnectService();
   }

   async register(userData: {
      email: string;
      password: string;
      phone: string;
      fullName: string;
      role?: string;
      address?: string;
      city?: string;
      businessName?: string;  // restaurant_owner
      country?: string;
   }) {
      // check if user exists
      const existingUser = await this.db.select()
         .from(users)
         .where(eq(users.email, userData.email))
         .limit(1);
      if (existingUser.length > 0) {
         throw new Error('Email already registered');
      }

      const passwordHash = await bcrypt.hash(userData.password, 12);
      const role = (userData.role as any) || 'customer';

      const [newUser] = await this.db.insert(users).values({
         email: userData.email,
         password: passwordHash,
         phone: userData.phone,
         fullName: userData.fullName,
         role: role,
         address: userData.address || null,
         status: 'active',
         createdAt: new Date(),
         updatedAt: new Date()
      })
         .returning();

      if (role === 'restaurant_owner' || role === 'driver') {
         try {
            const stripeAccount = await this.createStripeAccount(newUser, userData);

            // Update user with Stripe account ID
            await this.db.update(users)
               .set({
                  stripeAccountId: stripeAccount.accountId,
                  updatedAt: new Date(),
                  stripeCreatedAt: new Date(),
                  stripeOnboardingCompleted: true
               })
               .where(eq(users.id, newUser.id));

            // Add Stripe info to return data
            return {
               ...newUser,
               stripeAccountId: stripeAccount.accountId,
               onboardingUrl: stripeAccount.onboardingUrl,
               onboardingRequired: true
            };
         } catch (stripeError) {
            console.error('Stripe account creation failed:', stripeError);
            // Don't fail registration if Stripe fails, but log it
            return {
               ...newUser,
               stripeAccountId: null,
               onboardingUrl: null,
               onboardingRequired: true,
               stripeError: 'Stripe account creation failed - can be retried later'
            };
         }
      }
      return newUser;
   }

   private async createStripeAccount(user: any, userData: any) {
      if (user.role === 'restaurant_owner') {
         return await this.stripeConnectService.createRestaurantAccount({
            email: user.email,
            businessName: userData.businessName || user.fullName,
            country: userData.country || 'SG'
         });
      } else if (user.role === 'driver') {
         const [firstName, ...lastNameParts] = user.fullName.split(' ');
         const lastName = lastNameParts.join(' ') || firstName;

         return await this.stripeConnectService.createDriverAccount({
            email: user.email,
            firstName: firstName,
            lastName: lastName,
            country: userData.country || 'SG'
         });
      }
      throw new Error('Invalid role for Stripe account creation');
   }

   async login(email: string, password: string) {
      // find user
      const user = await this.userService.getUserByEmail(email);
      if (!user) {
         throw new Error('Invalid credentials');
      }

      // verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
         throw new Error('Invalid password');
      }

      let onboardingStatus = {};
      if ((user.role === 'restaurant_owner' || user.role === 'driver') && user.stripeAccountId) {
         try {
            onboardingStatus = await this.stripeConnectService.getAccountStatus(user.stripeAccountId);
         } catch (error) {
            console.error('Failed to check Stripe account status:', error);
         }
      }

      return {
         ...user,
         onboardingStatus
      };
   }

   async createSession(userId: string, token: string) {
      const tokenHash = await bcrypt.hash(token, 10);

      return await this.db.insert(userSession).values({
         userId: userId,
         tokenHash: tokenHash,
         expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),   // 7 days
         createdAt: new Date()
      })
   }

   async retryStripeAccountCreation(userId: string, userData: {
      businessName?: string;
      country?: string;
   }) {
      const user = await this.userService.getUserById(userId);
      if (!user) {
         throw new Error('User not found');
      }

      if (user.stripeAccountId) {
         throw new Error('User already has a Stripe account');
      }

      if (user.role !== 'restaurant_owner' && user.role !== 'driver') {
         throw new Error('User role does not require Stripe account');
      }

      const stripeAccount = await this.createStripeAccount(user, userData);

      // Update user with Stripe account ID
      await this.db.update(users)
         .set({
            stripeAccountId: stripeAccount.accountId,
            updatedAt: new Date(),
            stripeCreatedAt: new Date(),
            stripeOnboardingCompleted: true
         })
         .where(eq(users.id, userId));

      return stripeAccount;
   }

   async getOnboardingStatus(userId: string) {
      const user = await this.userService.getUserById(userId);
      if (!user) {
         throw new Error('User not found');
      }

      if (!user.stripeAccountId) {
         return {
            hasStripeAccount: false,
            onboardingRequired: true,
            onboardingCompleted: false
         };
      }

      try {
         const accountStatus = await this.stripeConnectService.getAccountStatus(user.stripeAccountId);
         return {
            hasStripeAccount: true,
            onboardingRequired: !accountStatus.details_submitted,
            onboardingCompleted: accountStatus.details_submitted && accountStatus.charges_enabled,
            accountStatus
         };
      } catch (error) {
         console.error('Failed to check account status:', error);
         return {
            hasStripeAccount: true,
            onboardingRequired: true,
            onboardingCompleted: false,
            error: 'Failed to check account status'
         };
      }
   }

   async deleteUserSessions(userId: string) {
      return await this.db.delete(userSession)
         .where(eq(userSession.userId, userId));
   }
}