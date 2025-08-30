import { describe, it, expect, beforeEach, mock, spyOn } from "bun:test";
import { StripeConnectService } from "../../src/services/stripe-connect.service";
import Stripe from "stripe";

// Create proper mock objects that match Stripe's Response<T> interface
const createMockAccount = (overrides: any = {}): Stripe.Response<Stripe.Account> => ({
   id: 'acct_123',
   object: 'account',
   charges_enabled: true,
   details_submitted: true,
   email: 'test@example.com',
   payouts_enabled: true,
   type: 'express' as Stripe.Account.Type,
   country: 'SG',
   default_currency: 'sgd',
   business_type: 'company' as Stripe.Account.BusinessType,
   created: 1640995200,
   requirements: {
      currently_due: [],
      eventually_due: [],
      past_due: [],
      pending_verification: [],
      errors: [],
      disabled_reason: null,
   },
   capabilities: {
      card_payments: {
         status: 'active' as const,
         requested: true,
      },
      transfers: {
         status: 'active' as const,
         requested: true,
      },
   },
   business_profile: {
      mcc: '5812',
      minority_owned_business_designation: null,
      support_address: null,
      support_email: null,
      support_phone: null,
      support_url: null,
      url: null,
   },
   metadata: {},
   ...overrides,
   lastResponse: {
      headers: {},
      requestId: 'req_123',
      statusCode: 200,
      apiVersion: '2025-07-30.basil',
      idempotencyKey: undefined,
      stripeAccount: undefined,
   },
});

const createMockTransfer = (overrides: any = {}): Stripe.Response<Stripe.Transfer> => ({
   id: 'tr_123',
   object: 'transfer',
   amount: 1000,
   amount_reversed: 0,
   balance_transaction: 'txn_123',
   created: 1640995200,
   currency: 'sgd',
   description: null,
   destination: 'acct_restaurant123',
   destination_payment: null,
   livemode: false,
   metadata: {},
   reversals: {
      object: 'list',
      data: [],
      has_more: false,
      total_count: 0,
      url: '/v1/transfers/tr_123/reversals',
   },
   reversed: false,
   source_transaction: null,
   source_type: 'card' as const,
   transfer_group: null,
   ...overrides,
   lastResponse: {
      headers: {},
      requestId: 'req_123',
      statusCode: 200,
      apiVersion: '2025-07-30.basil',
      idempotencyKey: undefined,
      stripeAccount: undefined,
   },
});

const createMockBalance = (overrides: any = {}): Stripe.Response<Stripe.Balance> => ({
   object: 'balance',
   livemode: false,
   available: [{ amount: 2000, currency: 'sgd', source_types: {} }],
   pending: [{ amount: 500, currency: 'sgd', source_types: {} }],
   connect_reserved: [],
   instant_available: [],
   issuing: {
      available: [],
   },
   ...overrides,
   lastResponse: {
      headers: {},
      requestId: 'req_123',
      statusCode: 200,
      apiVersion: '2025-07-30.basil',
      idempotencyKey: undefined,
      stripeAccount: undefined,
   },
});

const mockStripe = {
   accounts: {
      create: mock(),
      retrieve: mock(),
      update: mock(),
      del: mock(),
      createLoginLink: mock()
   },
   accountLinks: {
      create: mock()
   },
   transfers: {
      create: mock(),
      list: mock()
   },
   balance: {
      retrieve: mock()
   },
   webhooks: {
      constructEvent: mock()
   }
};

// Mock the Stripe constructor properly
mock.module("stripe", () => {
   return {
      default: class MockStripe {
         public accounts = mockStripe.accounts;
         public accountLinks = mockStripe.accountLinks;
         public transfers = mockStripe.transfers;
         public balance = mockStripe.balance;
         public webhooks = mockStripe.webhooks;

         constructor(secretKey: string, config: any) {
            // Mock constructor - don't do anything
         }
      }
   };
});

describe('StripeConnectService', () => {
   let stripeConnectService: StripeConnectService;

   beforeEach(() => {
      // Set a valid test API key format
      process.env.STRIPE_SECRET_KEY = 'sk_test_51234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmnop';
      process.env.PORT_USER = '3000';

      // Reset all mocks
      mockStripe.accounts.create.mockReset();
      mockStripe.accounts.retrieve.mockReset();
      mockStripe.accounts.update.mockReset();
      mockStripe.accounts.del.mockReset();
      mockStripe.accounts.createLoginLink.mockReset();
      mockStripe.accountLinks.create.mockReset();
      mockStripe.transfers.create.mockReset();
      mockStripe.transfers.list.mockReset();
      mockStripe.balance.retrieve.mockReset();
      mockStripe.webhooks.constructEvent.mockReset();

      stripeConnectService = new StripeConnectService();
   });

   describe('createRestaurantAccount', () => {
      it('should create restaurant account successfully', async () => {
         const restaurantData = {
            email: 'restaurant@example.com',
            businessName: 'Test Restaurant',
            country: 'SG'
         };

         const mockAccount = createMockAccount({
            id: 'acct_restaurant123',
            type: 'express' as Stripe.Account.Type,
            country: 'SG',
            business_type: 'company' as Stripe.Account.BusinessType
         });

         const mockAccountLink = {
            url: 'https://connect.stripe.com/setup/restaurant123'
         };

         mockStripe.accounts.create.mockResolvedValue(mockAccount);
         mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);

         const result = await stripeConnectService.createRestaurantAccount(restaurantData);

         expect(mockStripe.accounts.create).toHaveBeenCalledWith({
            type: 'express',
            country: 'SG',
            email: 'restaurant@example.com',
            business_type: 'company',
            company: {
               name: 'Test Restaurant'
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

         expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
            account: 'acct_restaurant123',
            refresh_url: 'HTTP://localhost:3000/restaurant/onboarding/refresh',
            return_url: 'HTTP://localhost:3000/restaurant/onboarding/complete',
            type: 'account_onboarding'
         });

         expect(result).toEqual({
            accountId: 'acct_restaurant123',
            onboardingUrl: 'https://connect.stripe.com/setup/restaurant123',
            account: mockAccount
         });
      });

      it('should handle restaurant account creation error', async () => {
         const restaurantData = {
            email: 'restaurant@example.com',
            businessName: 'Test Restaurant',
            country: 'SG'
         };

         mockStripe.accounts.create.mockRejectedValue(new Error('Stripe API error'));

         await expect(stripeConnectService.createRestaurantAccount(restaurantData))
            .rejects.toThrow('Failed to create restaurant account: Stripe API error');
      });

      it('should use custom account type if provided', async () => {
         const restaurantData = {
            email: 'restaurant@example.com',
            businessName: 'Test Restaurant',
            country: 'SG',
            type: 'standard' as const
         };

         const mockAccount = createMockAccount({ id: 'acct_restaurant123' });
         const mockAccountLink = { url: 'https://connect.stripe.com/setup/restaurant123' };

         mockStripe.accounts.create.mockResolvedValue(mockAccount);
         mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);

         await stripeConnectService.createRestaurantAccount(restaurantData);

         expect(mockStripe.accounts.create).toHaveBeenCalledWith(
            expect.objectContaining({
               type: 'standard'
            })
         );
      });
   });

   describe('createDriverAccount', () => {
      it('should create driver account successfully', async () => {
         const driverData = {
            email: 'driver@example.com',
            firstName: 'John',
            lastName: 'Doe',
            country: 'SG'
         };

         const mockAccount = createMockAccount({
            id: 'acct_driver123',
            type: 'express' as Stripe.Account.Type,
            country: 'SG',
            business_type: 'individual' as Stripe.Account.BusinessType
         });

         const mockAccountLink = {
            url: 'https://connect.stripe.com/setup/driver123'
         };

         mockStripe.accounts.create.mockResolvedValue(mockAccount);
         mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);

         const result = await stripeConnectService.createDriverAccount(driverData);

         expect(mockStripe.accounts.create).toHaveBeenCalledWith({
            type: 'express',
            country: 'SG',
            email: 'driver@example.com',
            business_type: 'individual',
            individual: {
               first_name: 'John',
               last_name: 'Doe',
               email: 'driver@example.com',
            },
            capabilities: {
               transfers: { requested: true },
            },
            business_profile: {
               mcc: '4121',
               product_description: 'Food delivery driver services',
            },
            settings: {
               payouts: {
                  schedule: {
                     interval: 'daily',
                  },
               },
            },
         });

         expect(result).toEqual({
            accountId: 'acct_driver123',
            onboardingUrl: 'https://connect.stripe.com/setup/driver123',
            account: mockAccount
         });
      });

      it('should handle driver account creation error', async () => {
         const driverData = {
            email: 'driver@example.com',
            firstName: 'John',
            lastName: 'Doe',
            country: 'SG'
         };

         mockStripe.accounts.create.mockRejectedValue(new Error('Invalid country'));

         await expect(stripeConnectService.createDriverAccount(driverData))
            .rejects.toThrow('Failed to create driver account: Invalid country');
      });
   });

   describe('createOnboardingLink', () => {
      it('should create onboarding link successfully', async () => {
         const accountId = 'acct_123';
         const refreshUrl = 'https://app.com/refresh';
         const returnUrl = 'https://app.com/return';

         const mockAccountLink = {
            url: 'https://connect.stripe.com/setup/123'
         };

         mockStripe.accountLinks.create.mockResolvedValue(mockAccountLink);

         const result = await stripeConnectService.createOnboardingLink(accountId, refreshUrl, returnUrl);

         expect(mockStripe.accountLinks.create).toHaveBeenCalledWith({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding'
         });

         expect(result).toBe('https://connect.stripe.com/setup/123');
      });

      it('should handle onboarding link creation error', async () => {
         mockStripe.accountLinks.create.mockRejectedValue(new Error('Account not found'));

         await expect(stripeConnectService.createOnboardingLink('acct_invalid', 'refresh', 'return'))
            .rejects.toThrow('Failed to create onboarding link: Account not found');
      });
   });

   describe('getAccountStatus', () => {
      it('should retrieve account status successfully', async () => {
         const accountId = 'acct_123';
         const mockAccount = createMockAccount({
            id: 'acct_123',
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            type: 'express' as Stripe.Account.Type,
            country: 'SG',
            default_currency: 'sgd',
            requirements: {
               currently_due: [],
               eventually_due: ['individual.verification.document'],
               past_due: [],
               pending_verification: [],
               errors: [],
               disabled_reason: null,
            },
            business_profile: {
               mcc: '5812',
               minority_owned_business_designation: null,
               support_address: null,
               support_email: null,
               support_phone: null,
               support_url: null,
               url: null,
               name: 'Test Business'
            },
            created: 1640995200
         });

         mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

         const result = await stripeConnectService.getAccountStatus(accountId);

         expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(accountId);
         expect(result).toEqual({
            id: 'acct_123',
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
            type: 'express',
            country: 'SG',
            default_currency: 'sgd',
            requirements: {
               currently_due: [],
               eventually_due: ['individual.verification.document'],
               past_due: [],
               pending_verification: []
            },
            capabilities: mockAccount.capabilities,
            business_profile: mockAccount.business_profile,
            created: 1640995200
         });
      });

      it('should handle account status retrieval error', async () => {
         mockStripe.accounts.retrieve.mockRejectedValue(new Error('Account not found'));

         await expect(stripeConnectService.getAccountStatus('acct_invalid'))
            .rejects.toThrow('Failed to get account status: Account not found');
      });
   });

   describe('updateAccount', () => {
      it('should update account successfully', async () => {
         const accountId = 'acct_123';
         const updates = { business_profile: { name: 'Updated Business' } };
         const mockUpdatedAccount = createMockAccount({
            id: accountId,
            business_profile: {
               mcc: '5812',
               minority_owned_business_designation: null,
               support_address: null,
               support_email: null,
               support_phone: null,
               support_url: null,
               url: null,
               name: 'Updated Business'
            }
         });

         mockStripe.accounts.update.mockResolvedValue(mockUpdatedAccount);

         const result = await stripeConnectService.updateAccount(accountId, updates);

         expect(mockStripe.accounts.update).toHaveBeenCalledWith(accountId, updates);
         expect(result).toEqual(mockUpdatedAccount);
      });

      it('should handle account update error', async () => {
         mockStripe.accounts.update.mockRejectedValue(new Error('Update failed'));

         await expect(stripeConnectService.updateAccount('acct_123', {}))
            .rejects.toThrow('Failed to update account: Update failed');
      });
   });

   describe('createTransfer', () => {
      it('should create transfer successfully', async () => {
         const transferParams = {
            amount: 1000,
            currency: 'sgd',
            destination: 'acct_restaurant123',
            metadata: { order_id: 'order_123' },
            description: 'Payment for order #123'
         };

         const mockTransfer = createMockTransfer({
            id: 'tr_123',
            amount: 1000,
            currency: 'sgd',
            destination: 'acct_restaurant123',
            metadata: { order_id: 'order_123' },
            description: 'Payment for order #123'
         });

         mockStripe.transfers.create.mockResolvedValue(mockTransfer);

         const result = await stripeConnectService.createTransfer(transferParams);

         expect(mockStripe.transfers.create).toHaveBeenCalledWith({
            amount: 1000,
            currency: 'sgd',
            destination: 'acct_restaurant123',
            metadata: { order_id: 'order_123' },
            description: 'Payment for order #123'
         });

         expect(result).toEqual(mockTransfer);
      });

      it('should handle transfer creation error', async () => {
         const transferParams = {
            amount: 1000,
            currency: 'sgd',
            destination: 'acct_invalid'
         };

         mockStripe.transfers.create.mockRejectedValue(new Error('Invalid destination'));

         await expect(stripeConnectService.createTransfer(transferParams))
            .rejects.toThrow('Failed to create transfer: Invalid destination');
      });
   });

   describe('getAccountBalance', () => {
      it('should retrieve account balance successfully', async () => {
         const accountId = 'acct_123';
         const mockBalance = createMockBalance({
            available: [{ amount: 2000, currency: 'sgd', source_types: {} }],
            pending: [{ amount: 500, currency: 'sgd', source_types: {} }]
         });

         mockStripe.balance.retrieve.mockResolvedValue(mockBalance);

         const result = await stripeConnectService.getAccountBalance(accountId);

         expect(mockStripe.balance.retrieve).toHaveBeenCalledWith({
            stripeAccount: accountId
         });

         expect(result).toEqual(mockBalance);
      });

      it('should handle balance retrieval error', async () => {
         mockStripe.balance.retrieve.mockRejectedValue(new Error('Access denied'));

         await expect(stripeConnectService.getAccountBalance('acct_invalid'))
            .rejects.toThrow('Failed to get account balance: Access denied');
      });
   });

   describe('listTransfers', () => {
      it('should list transfers successfully', async () => {
         const mockTransfersList: Stripe.Response<Stripe.ApiList<Stripe.Transfer>> = {
            object: 'list' as const,
            data: [
               createMockTransfer({ id: 'tr_1' }),
               createMockTransfer({ id: 'tr_2' })
            ],
            has_more: false,
            url: '/v1/transfers',
            lastResponse: {
               headers: {},
               requestId: 'req_123',
               statusCode: 200,
               apiVersion: '2025-07-30.basil',
               idempotencyKey: undefined,
               stripeAccount: undefined,
            },
         };

         mockStripe.transfers.list.mockResolvedValue(mockTransfersList);

         const result = await stripeConnectService.listTransfers({
            destination: 'acct_123',
            limit: 5
         });

         expect(mockStripe.transfers.list).toHaveBeenCalledWith({
            destination: 'acct_123',
            created: undefined,
            limit: 5
         });

         expect(result).toEqual(mockTransfersList);
      });
   });

   describe('deleteAccount', () => {
      it('should delete account successfully', async () => {
         const accountId = 'acct_123';
         const mockDeleted: Stripe.Response<Stripe.DeletedAccount> = {
            id: accountId,
            object: 'account' as const,
            deleted: true,
            lastResponse: {
               headers: {},
               requestId: 'req_123',
               statusCode: 200,
               apiVersion: '2025-07-30.basil',
               idempotencyKey: undefined,
               stripeAccount: undefined,
            },
         };

         mockStripe.accounts.del.mockResolvedValue(mockDeleted);

         const result = await stripeConnectService.deleteAccount(accountId);

         expect(mockStripe.accounts.del).toHaveBeenCalledWith(accountId);
         expect(result).toEqual(mockDeleted);
      });
   });

   describe('createLoginLink', () => {
      it('should create login link successfully', async () => {
         const accountId = 'acct_123';
         const mockLoginLink = {
            object: 'login_link',
            created: 1640995200,
            url: 'https://connect.stripe.com/express/login_link_123'
         };

         mockStripe.accounts.createLoginLink.mockResolvedValue(mockLoginLink);

         const result = await stripeConnectService.createLoginLink(accountId);

         expect(mockStripe.accounts.createLoginLink).toHaveBeenCalledWith(accountId);
         expect(result).toBe('https://connect.stripe.com/express/login_link_123');
      });
   });

   describe('verifyWebHookSignature', () => {
      it('should verify webhook signature successfully', async () => {
         const payload = '{"id":"evt_123"}';
         const signature = 'sig_123';
         const secret = 'whsec_123';
         const mockEvent: Stripe.Event = {
            id: 'evt_123',
            object: 'event',
            type: 'account.updated',
            api_version: '2025-07-30.basil',
            created: 1640995200,
            data: {
               object: {
                  id: 'acct_123',
                  object: 'account',
                  type: 'express'
               } as Stripe.Account,
               previous_attributes: {}
            },
            livemode: false,
            pending_webhooks: 1,
            request: {
               id: 'req_123',
               idempotency_key: null
            }
         };

         mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

         const result = stripeConnectService.verifyWebHookSignature(payload, signature, secret);

         expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(payload, signature, secret);
         expect(result).toEqual(mockEvent);
      });

      it('should handle webhook verification error', () => {
         mockStripe.webhooks.constructEvent.mockImplementation(() => {
            throw new Error('Invalid signature');
         });

         expect(() => {
            stripeConnectService.verifyWebHookSignature('payload', 'sig', 'secret');
         }).toThrow('Webhook signature verification failed: Invalid signature');
      });
   });

   describe('canReceivePayments', () => {
      it('should return true when account can receive payments', async () => {
         const accountId = 'acct_123';
         const mockAccount = createMockAccount({
            charges_enabled: true,
            details_submitted: true
         });

         mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

         const result = await stripeConnectService.canReceivePayments(accountId);

         expect(result).toBe(true);
      });

      it('should return false when account cannot receive payments', async () => {
         const accountId = 'acct_123';
         const mockAccount = createMockAccount({
            charges_enabled: false,
            details_submitted: true
         });

         mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

         const result = await stripeConnectService.canReceivePayments(accountId);

         expect(result).toBe(false);
      });

      it('should return false on error', async () => {
         mockStripe.accounts.retrieve.mockRejectedValue(new Error('Account not found'));

         const result = await stripeConnectService.canReceivePayments('acct_invalid');

         expect(result).toBe(false);
      });
   });

   describe('canReceivePayouts', () => {
      it('should return true when account can receive payouts', async () => {
         const accountId = 'acct_123';
         const mockAccount = createMockAccount({
            payouts_enabled: true,
            details_submitted: true
         });

         mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

         const result = await stripeConnectService.canReceivePayouts(accountId);

         expect(result).toBe(true);
      });

      it('should return false when account cannot receive payouts', async () => {
         const accountId = 'acct_123';
         const mockAccount = createMockAccount({
            payouts_enabled: false,
            details_submitted: true
         });

         mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

         const result = await stripeConnectService.canReceivePayouts(accountId);

         expect(result).toBe(false);
      });
   });
});