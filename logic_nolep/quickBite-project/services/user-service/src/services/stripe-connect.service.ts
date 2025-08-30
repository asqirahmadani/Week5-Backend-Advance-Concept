import Stripe from 'stripe';

export class StripeConnectService {
   private stripe: Stripe;

   constructor() {
      if (!process.env.STRIPE_SECRET_KEY) {
         throw new Error('STRIPE_SECRET_KEY is required');
      }

      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
         apiVersion: '2025-07-30.basil'
      });
   }

   // create stripe connect account for restaurant
   async createRestaurantAccount(restaurantData: {
      email: string;
      businessName: string;
      country: string;
      type?: 'express' | 'standard' | 'custom'
   }) {
      try {
         // create express account (recommended for most use cases)
         const account = await this.stripe.accounts.create({
            type: restaurantData.type || 'express',
            country: restaurantData.country || 'SG',
            email: restaurantData.email,
            business_type: 'company',
            company: {
               name: restaurantData.businessName
            },
            capabilities: {
               card_payments: { requested: true },
               transfers: { requested: true }
            },
            business_profile: {
               mcc: '5812',
               product_description: 'Food delivery and restaurant services'
            },
            settings: {
               payouts: {
                  schedule: {
                     interval: 'daily'
                  }
               }
            }
         });

         // generate onboarding link
         const onboardingUrl = await this.createOnboardingLink(
            account.id,
            `HTTP://localhost:${process.env.PORT_USER}/restaurant/onboarding/refresh`,
            `HTTP://localhost:${process.env.PORT_USER}/restaurant/onboarding/complete`
         );

         return {
            accountId: account.id,
            onboardingUrl,
            account
         };
      } catch (error) {
         console.error('Failed to create restaurant Stripe account:', error);
         throw new Error(`Failed to create restaurant account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async createDriverAccount(driverData: {
      email: string;
      firstName: string;
      lastName: string;
      country: string;
      type?: 'express' | 'standard' | 'custom'
   }) {
      try {
         const account = await this.stripe.accounts.create({
            type: driverData.type || 'express',
            country: driverData.country || 'SG',
            email: driverData.email,
            business_type: 'individual',
            individual: {
               first_name: driverData.firstName,
               last_name: driverData.lastName,
               email: driverData.email,
            },
            capabilities: {
               transfers: { requested: true },
            },
            business_profile: {
               mcc: '4121', // Taxicabs and limousines
               product_description: 'Food delivery driver services',
            },
            settings: {
               payouts: {
                  schedule: {
                     interval: 'daily', // Daily payouts
                  },
               },
            },
         });

         const onboardingUrl = await this.createOnboardingLink(
            account.id,
            `HTTP://localhost:${process.env.PORT_USER}/driver/onboarding/refresh`,
            `HTTP://localhost:${process.env.PORT_USER}/driver/onboarding/complete`
         );

         return {
            accountId: account.id,
            onboardingUrl,
            account
         };
      } catch (error) {
         console.error('Failed to create driver Stripe account:', error);
         throw new Error(`Failed to create driver account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async createOnboardingLink(accountId: string, refreshUrl: string, returnUrl: string) {
      try {
         const accountLink = await this.stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding'
         });

         return accountLink.url;
      } catch (error) {
         console.error('Failed to create onboarding link:', error);
         throw new Error(`Failed to create onboarding link: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async getAccountStatus(accountId: string) {
      try {
         const account = await this.stripe.accounts.retrieve(accountId);

         return {
            id: account.id,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            type: account.type,
            country: account.country,
            default_currency: account.default_currency,
            requirements: {
               currently_due: account.requirements?.currently_due || [],
               eventually_due: account.requirements?.eventually_due || [],
               past_due: account.requirements?.past_due || [],
               pending_verification: account.requirements?.pending_verification || [],
            },
            capabilities: account.capabilities,
            business_profile: account.business_profile,
            created: account.created,
         };
      } catch (error) {
         console.error('Failed to get account status:', error);
         throw new Error(`Failed to get account status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async updateAccount(accountId: string, updates: any) {
      try {
         const account = await this.stripe.accounts.update(accountId, updates);
         return account;
      } catch (error) {
         console.error('Failed to update account:', error);
         throw new Error(`Failed to update account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async createTransfer(params: {
      amount: number;
      currency: string;
      destination: string;
      metadata?: Record<string, string>;
      description?: string;
   }) {
      try {
         const transfer = await this.stripe.transfers.create({
            amount: params.amount,
            currency: params.currency,
            destination: params.destination,
            metadata: params.metadata || {},
            description: params.description,
         });

         return transfer;
      } catch (error) {
         console.error('Failed to create transfer:', error);
         throw new Error(`Failed to create transfer: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async getAccountBalance(accountId: string) {
      try {
         const balance = await this.stripe.balance.retrieve({
            stripeAccount: accountId,
         });

         return balance;
      } catch (error) {
         console.error('Failed to get account balance:', error);
         throw new Error(`Failed to get account balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async listTransfers(params: {
      destination?: string;
      created?: any;
      limit?: number;
   } = {}) {
      try {
         const transfers = await this.stripe.transfers.list({
            destination: params.destination,
            created: params.created,
            limit: params.limit || 10,
         });

         return transfers;
      } catch (error) {
         console.error('Failed to list transfers:', error);
         throw new Error(`Failed to list transfers: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async deleteAccount(accountId: string) {
      try {
         const deleted = await this.stripe.accounts.del(accountId);
         return deleted;
      } catch (error) {
         console.error('Failed to delete account:', error);
         throw new Error(`Failed to delete account: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async createLoginLink(accountId: string) {
      try {
         const loginLink = await this.stripe.accounts.createLoginLink(accountId);
         return loginLink.url;
      } catch (error) {
         console.error('Failed to create login link:', error);
         throw new Error(`Failed to create login link: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   verifyWebHookSignature(payload: string, signature: string, secret: string): Stripe.Event {
      try {
         return this.stripe.webhooks.constructEvent(payload, signature, secret);
      } catch (error) {
         console.error('Webhook signature verification failed:', error);
         throw new Error(`Webhook signature verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async getAccountRequirements(accountId: string) {
      try {
         const account = await this.stripe.accounts.retrieve(accountId);

         return {
            requirements: account.requirements,
            capabilities: Object.entries(account.capabilities || {}).map(([key, value]) => ({
               capability: key,
               status: value.status,
               requirements: value.requirements,
            })),
         };
      } catch (error) {
         console.error('Failed to get account requirements:', error);
         throw new Error(`Failed to get account requirements: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
   }

   async canReceivePayments(accountId: string): Promise<boolean> {
      try {
         const account = await this.stripe.accounts.retrieve(accountId);
         return account.charges_enabled && account.details_submitted;
      } catch (error) {
         console.error('Failed to check payment capability:', error);
         return false;
      }
   }

   async canReceivePayouts(accountId: string): Promise<boolean> {
      try {
         const account = await this.stripe.accounts.retrieve(accountId);
         return account.payouts_enabled && account.details_submitted;
      } catch (error) {
         console.error('Failed to check payout capability:', error);
         return false;
      }
   }
}