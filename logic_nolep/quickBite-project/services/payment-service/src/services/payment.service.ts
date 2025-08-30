import { payments, driverEarnings, restaurantSettlements } from "../db/schema";
import { validateAmount, sanitizeAmount } from "../utils/validation";
import { db, type Database } from "../db/client";
import { StripeService } from "./stripe.service";
import { eq, and } from "drizzle-orm";
import type {
   CreatePaymentRequest,
   CreateCheckoutPaymentSchema,
   PaymentResponse,
   CreateDriverEarningRequest,
   EarningResponse,
   CreateSettlementRequest,
   SettlementResponse,
   OrderDetails
} from "../types";

interface PaymentResponseWithUrl extends PaymentResponse {
   paymentUrl?: string;
   sessionId?: string;
}

export class PaymentService {
   private stripeService: StripeService;
   private db: Database;

   constructor(injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
      this.stripeService = new StripeService();
   }

   async createPayment(data: CreatePaymentRequest, userId: string): Promise<PaymentResponse> {
      try {
         if (!validateAmount(data.amount)) {
            throw new Error('Invalid payment amount');
         }

         const sanitizedAmount = sanitizeAmount(parseInt(data.amount));
         const orderDetails = await this.getOrderDetails(data.orderId);
         if (!orderDetails) {
            throw new Error('Order not found');
         }

         const paymentIntent = await this.stripeService.createPaymentIntent(
            sanitizedAmount,
            data.currency || 'USD',
            {
               orderId: data.orderId,
               userId: userId
            }
         );

         // save payment record
         const payment = await this.db.insert(payments)
            .values({
               orderId: data.orderId,
               userId: userId,
               stripePaymentIntentId: paymentIntent.id,
               amount: sanitizedAmount.toString(),
               currency: data.currency || 'USD',
               paymentMethod: data.paymentMethod,
               status: 'pending',
               metadata: data.metadata ? JSON.stringify(data.metadata) : null
            })
            .returning();

         return {
            id: payment[0].id,
            orderId: payment[0].orderId,
            amount: parseFloat(payment[0].amount),
            status: payment[0].status,
            clientSecret: paymentIntent.client_secret!,
            paymentIntentId: paymentIntent.id
         }
      } catch (error) {
         throw new Error(`Failed to create payment: ${error}`);
      }
   }

   async createPaymentWithCheckout(data: CreatePaymentRequest, userId: string, userEmail: string): Promise<PaymentResponseWithUrl> {
      try {
         if (!validateAmount(parseInt(data.amount))) {
            throw new Error('Invalid payment amount');
         }

         const sanitizedAmount = sanitizeAmount(parseInt(data.amount));
         const orderDetails = await this.getOrderDetails(data.orderId);
         if (!orderDetails) {
            throw new Error('Order not found');
         }

         // create checkout session
         const checkoutSession = await this.stripeService.createCheckoutSession(
            sanitizedAmount,
            data.currency || 'USD',
            {
               orderId: data.orderId,
               userId: userId
            },
            data.successUrl || 'http://localhost:3004/success?session_id={CHECKOUT_SESSION_ID}',
            data.cancelUrl || 'http://localhost:3004/cancel',
            userEmail
         );

         const payment = await this.db.insert(payments)
            .values({
               orderId: data.orderId,
               userId: userId,
               stripePaymentIntentId: checkoutSession.payment_intent as string || '',
               amount: sanitizedAmount.toString(),
               currency: data.currency || 'USD',
               paymentMethod: data.paymentMethod,
               status: 'pending',
               metadata: JSON.stringify({
                  sessionId: checkoutSession.id,
                  ...(data.metadata || {})
               })
            })
            .returning();

         return {
            id: payment[0].id,
            orderId: payment[0].orderId,
            amount: parseFloat(payment[0].amount),
            status: payment[0].status,
            clientSecret: '', // Not needed for checkout session
            paymentIntentId: checkoutSession.payment_intent as string || '',
            paymentUrl: checkoutSession.url!, // This is the payment URL
            sessionId: checkoutSession.id
         }
      } catch (error) {
         throw new Error(`Failed to create payment with checkout: ${error}`);
      }
   }

   async createPaymentLink(data: CreatePaymentRequest, userId: string): Promise<{ paymentLinkUrl: string; paymentLinkId: string }> {
      try {
         if (!validateAmount(data.amount)) {
            throw new Error('Invalid payment amount');
         }

         const sanitizedAmount = sanitizeAmount(data.amount);
         const orderDetails = await this.getOrderDetails(data.orderId);
         if (!orderDetails) {
            throw new Error('Order not found');
         }

         const paymentLink = await this.stripeService.createPaymentLink(
            sanitizedAmount,
            data.currency || 'USD',
            {
               orderId: data.orderId,
               userId: userId
            }
         );

         return {
            paymentLinkUrl: paymentLink.url,
            paymentLinkId: paymentLink.id
         };
      } catch (error) {
         throw new Error(`Failed to create payment link: ${error}`);
      }
   }

   async getPaymentByOrderId(orderId: string) {
      try {
         const payment = await this.db.select()
            .from(payments)
            .where(eq(payments.orderId, orderId))
            .limit(1);

         return payment[0] || null;
      } catch (error) {
         throw new Error(`Failed to get payment: ${error}`);
      }
   }

   // update payment status
   async updatePaymentStatus(paymentIntentId: string, status: string) {
      try {
         // Cari payment berdasarkan payment intent ID
         let payment = await this.db.select()
            .from(payments)
            .where(eq(payments.stripePaymentIntentId, paymentIntentId))
            .limit(1);

         // Jika tidak ditemukan dengan payment intent ID, coba cari dari metadata
         if (payment.length === 0) {

            // Ambil semua pending payments
            const allPendingPayments = await this.db.select()
               .from(payments)
               .where(eq(payments.status, 'pending'));

            // Cari yang memiliki payment intent ID yang kosong tapi metadata cocok
            const matchingPayment = allPendingPayments.find(p => {
               try {
                  const metadata = JSON.parse(p.metadata || '{}');
                  // Ini akan diupdate oleh checkout session completed
                  return p.stripePaymentIntentId === '' || p.stripePaymentIntentId === paymentIntentId;
               } catch {
                  return false;
               }
            });

            if (matchingPayment) {
               payment = [matchingPayment];
            }
         }

         if (payment.length === 0) {
            return null;
         }

         const updateData: any = {
            status: status as any,
            updatedAt: new Date()
         };

         // Update payment intent ID jika belum ada
         if (!payment[0].stripePaymentIntentId || payment[0].stripePaymentIntentId === '') {
            updateData.stripePaymentIntentId = paymentIntentId;
         }

         const updatedPayment = await this.db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, payment[0].id))
            .returning();

         // Notify order service hanya jika belum di-notify
         if (status === 'succeeded' && payment[0].status !== 'succeeded') {
            await this.notifyOrderService(updatedPayment[0].orderId, 'paid');
         } else if (status === 'failed' && payment[0].status !== 'failed') {
            await this.notifyOrderService(updatedPayment[0].orderId, 'failed');
         }

         return updatedPayment[0];
      } catch (error) {
         throw new Error(`Failed to update payment status: ${error}`);
      }
   }

   async getPaymentByIntentId(intentId: string) {
      try {
         const payment = await this.db.select()
            .from(payments)
            .where(eq(payments.stripePaymentIntentId, intentId))
            .limit(1);
         return payment[0] || null;
      } catch (error) {
         console.error('Error getting payment by intent ID:', error);
         return null;
      }
   }

   async updatePaymentStatusBySessionId(sessionId: string, status: string, paymentIntentId?: string) {
      try {
         const updateData: any = {
            status: status as any,
            updatedAt: new Date()
         };

         // Update payment intent ID if provided (from completed session)
         if (paymentIntentId) {
            updateData.stripePaymentIntentId = paymentIntentId;
         }

         // Find payment by session ID in metadata
         const existingPayment = await this.db.select()
            .from(payments)
            .where(eq(payments.metadata, JSON.stringify({ sessionId })))
            .limit(1);

         if (existingPayment.length === 0) {
            // Try to find with metadata containing sessionId
            const allPayments = await this.db.select()
               .from(payments)
               .where(eq(payments.status, 'pending'));

            const matchingPayment = allPayments.find(p => {
               try {
                  const metadata = JSON.parse(p.metadata || '{}');
                  return metadata.sessionId === sessionId;
               } catch {
                  return false;
               }
            });

            if (!matchingPayment) {
               throw new Error('Payment not found for session ID');
            }

            // Update the found payment
            const updatedPayment = await this.db
               .update(payments)
               .set(updateData)
               .where(eq(payments.id, matchingPayment.id))
               .returning();

            if (status === 'succeeded') {
               await this.notifyOrderService(updatedPayment[0].orderId, 'paid');
            } else if (status === 'failed') {
               await this.notifyOrderService(updatedPayment[0].orderId, 'failed');
            }

            return updatedPayment[0];
         }

         const updatedPayment = await this.db
            .update(payments)
            .set(updateData)
            .where(eq(payments.id, existingPayment[0].id))
            .returning();

         if (status === 'succeeded') {
            await this.notifyOrderService(updatedPayment[0].orderId, 'paid');
         } else if (status === 'failed') {
            await this.notifyOrderService(updatedPayment[0].orderId, 'failed');
         }

         return updatedPayment[0];
      } catch (error) {
         throw new Error(`Failed to update payment status by session ID: ${error}`);
      }
   }

   // create driver earnings
   async createDriverEarning(data: CreateDriverEarningRequest): Promise<EarningResponse> {
      try {
         if (!validateAmount(data.baseEarning)) {
            throw new Error('Invalid base earning amount');
         }

         const baseEarning = sanitizeAmount(data.baseEarning);
         const tipAmount = sanitizeAmount(data.tipAmount || 0);
         const bonusAmount = sanitizeAmount(data.bonusAmount || 0);
         const totalEarning = baseEarning + tipAmount + bonusAmount;

         const earning = await this.db.insert(driverEarnings)
            .values({
               driverId: data.driverId,
               orderId: data.orderId,
               baseEarning: baseEarning.toString(),
               tipAmount: tipAmount.toString(),
               bonusAmount: bonusAmount.toString(),
               totalEarning: totalEarning.toString(),
               payoutStatus: 'pending'
            })
            .returning();

         return {
            id: earning[0].id,
            driverId: earning[0].driverId,
            orderId: earning[0].orderId,
            totalEarning: parseFloat(earning[0].totalEarning),
            status: earning[0].payoutStatus!
         };
      } catch (error) {
         throw new Error(`Failed to create driver earning: ${error}`);
      }
   }

   // create restaurant settlement
   async createRestaurantSettlement(data: CreateSettlementRequest): Promise<SettlementResponse> {
      try {
         if (!validateAmount(data.grossAmount)) {
            throw new Error('Invalid gross amount');
         }

         if (data.commissionRate < 0 || data.commissionRate > 1) {
            throw new Error('Commission rate must be between 0 and 1');
         }

         const grossAmount = sanitizeAmount(data.grossAmount);
         const commissionAmount = sanitizeAmount(grossAmount * data.commissionRate);
         const netAmount = sanitizeAmount(grossAmount - commissionAmount);

         const settlement = await this.db.insert(restaurantSettlements)
            .values({
               restaurantId: data.restaurantId,
               orderId: data.orderId,
               grossAmount: grossAmount.toString(),
               commissionRate: data.commissionRate.toString(),
               commissionAmount: commissionAmount.toString(),
               netAmount: netAmount.toString(),
               settlementStatus: 'pending'
            })
            .returning();

         return {
            id: settlement[0].id,
            restaurantId: settlement[0].restaurantId,
            orderId: settlement[0].orderId,
            netAmount: parseFloat(settlement[0].netAmount),
            status: settlement[0].settlementStatus!
         }
      } catch (error) {
         throw new Error(`Failed to create restaurant settlement: ${error}`);
      }
   }

   // process driver payout
   async processDriverPayout(earningId: string, stripeAccountId: string) {
      try {
         const earning = await this.db.select()
            .from(driverEarnings)
            .where(eq(driverEarnings.id, earningId))
            .limit(1);

         if (!earning[0]) {
            throw new Error('Earning record not found');
         }

         if (earning[0].payoutStatus !== 'pending') {
            throw new Error('Earning already processed');
         }

         const payoutAmount = parseFloat(earning[0].totalEarning);
         if (!validateAmount(payoutAmount)) {
            throw new Error('Invalid payout amount');
         }

         const transfer = await this.stripeService.createTransfer(
            payoutAmount,
            stripeAccountId,
            'USD',
            {
               earningId: earningId,
               driverId: earning[0].driverId,
               orderId: earning[0].orderId
            }
         );

         // update earning record
         await this.db.update(driverEarnings)
            .set({
               payoutStatus: 'processing',
               stripeTransferId: transfer.id
            })
            .where(eq(driverEarnings.id, earningId));

         return transfer;
      } catch (error) {
         throw new Error(`Failed to process driver payout: ${error}`);
      }
   }

   // process restaurant settlement
   async processRestaurantSettlement(settlementId: string, stripeAccountId: string) {
      try {
         const settlement = await this.db.select()
            .from(restaurantSettlements)
            .where(eq(restaurantSettlements.id, settlementId))
            .limit(1);

         if (!settlement[0]) {
            throw new Error('Settlement record not found');
         }

         if (settlement[0].settlementStatus !== 'pending') {
            throw new Error('Settlement already processed');
         }

         const settlementAmount = parseFloat(settlement[0].netAmount);
         if (!validateAmount(settlementAmount)) {
            throw new Error('Invalid settlement amount');
         }

         // Create Stripe transfer
         const transfer = await this.stripeService.createTransfer(
            settlementAmount,
            stripeAccountId,
            'USD',
            {
               settlementId: settlementId,
               restaurantId: settlement[0].restaurantId,
               orderId: settlement[0].orderId,
            }
         );

         // Update settlement record
         await this.db
            .update(restaurantSettlements)
            .set({
               settlementStatus: 'processing',
               stripeTransferId: transfer.id,
            })
            .where(eq(restaurantSettlements.id, settlementId));

         return transfer;
      } catch (error) {
         throw new Error(`Failed to process restaurant settlement: ${error}`);
      }
   }

   // Get order details from order service
   private async getOrderDetails(orderId: string): Promise<OrderDetails | null> {
      try {
         const response = await fetch(`${process.env.ORDER_SERVICE_URL}/api/orders/${orderId}`);
         if (!response.ok) {
            return null;
         }
         return await response.json();
      } catch (error) {
         console.error('Failed to fetch order details:', error);
         return null;
      }
   }

   // Notify order service about payment status
   private async notifyOrderService(orderId: string, event: string) {
      try {
         await fetch(`${process.env.ORDER_SERVICE_URL}/api/orders/${orderId}/payment-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, timestamp: new Date().toISOString() }),
         });
      } catch (error) {
         console.error('Failed to notify order service:', error);
      }
   }

   // Notify notification service
   private async notifyNotificationService(data: any) {
      try {
         await fetch(`${process.env.NOTIFICATION_SERVICE_URL}/api/notifications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
         });
      } catch (error) {
         console.error('Failed to send notification:', error);
      }
   }
}