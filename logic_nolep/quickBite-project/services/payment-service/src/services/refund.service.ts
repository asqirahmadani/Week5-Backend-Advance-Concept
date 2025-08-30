import type { CreateRefundRequest, RefundResponse, RefundStatsResponse } from "../types";
import { validateAmount, sanitizeAmount } from "../utils/validation";
import { db, type Database } from "../db/client";
import { payments, refunds } from "../db/schema";
import { StripeService } from "./stripe.service";
import { eq } from "drizzle-orm";

export class RefundService {
   private db: Database;
   private stripeService: StripeService;

   constructor(injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
      this.stripeService = new StripeService();
   }

   async createRefund(data: CreateRefundRequest): Promise<RefundResponse> {
      try {
         const payment = await this.db
            .select()
            .from(payments)
            .where(eq(payments.orderId, data.orderId))
            .limit(1);

         if (!payment[0]) {
            throw new Error('Payment not found for this order');
         }

         if (payment[0].status !== 'succeeded') {
            throw new Error('Cannot refund payment that is not succeeded');
         }

         if (!payment[0].stripePaymentIntentId) {
            throw new Error('No Stripe payment intent found');
         }

         // determine refund amount
         const paymentAmount = parseFloat(payment[0].amount);
         const refundAmount = data.amount ? sanitizeAmount(data.amount) : paymentAmount;

         // validate refund amount
         if (refundAmount > parseFloat(payment[0].amount)) {
            throw new Error('Refund amount cannot exceed payment amount');
         }

         // check existing refunds - FIXED: use this.db instead of db
         const existingRefunds = await this.db.select()
            .from(refunds)
            .where(eq(refunds.paymentId, payment[0].id));

         const totalRefunded = existingRefunds
            .filter(r => r.status === 'succeeded')
            .reduce((sum, r) => sum + parseFloat(r.amount), 0);

         if (totalRefunded + refundAmount > paymentAmount) {
            throw new Error('Total refund amount would exceed payment amount');
         }

         const stripeReason = this.mapToStripeReason(data.reason);

         const stripeRefund = await this.stripeService.createRefund(
            payment[0].stripePaymentIntentId,
            refundAmount,
            stripeReason,
            {
               orderId: data.orderId,
               requestedBy: data.requestedBy
            }
         );

         // FIXED: use this.db instead of db
         const refund = await this.db
            .insert(refunds)
            .values({
               paymentId: payment[0].id,
               orderId: data.orderId,
               stripeRefundId: stripeRefund.id,
               amount: refundAmount.toString(),
               reason: data.reason,
               description: data.description,
               status: 'processing',
               requestedBy: data.requestedBy,
               requestedAt: new Date(),
            })
            .returning();

         // notify order service about refund
         const order = await this.notifyOrderService(data.orderId, 'refunded', refundAmount);

         return {
            id: refund[0].id,
            orderId: refund[0].orderId,
            amount: parseFloat(refund[0].amount),
            status: refund[0].status,
            refundId: stripeRefund.id
         }
      } catch (error) {
         throw new Error(`Failed to create refund: ${error}`);
      }
   }

   // get refund by order Id
   async getRefundsByOrderId(orderId: string) {
      try {
         const orderRefunds = await this.db.select()
            .from(refunds)
            .where(eq(refunds.orderId, orderId));

         return orderRefunds;
      } catch (error) {
         throw new Error(`Failed to get refunds: ${error}`);
      }
   }

   // update refund status (called by webhook)
   async updateRefundStatus(stripeRefundId: string, status: string) {
      try {
         const updatedRefund = await this.db
            .update(refunds)
            .set({
               status: status as any,
               processedAt: status === 'succeeded' ? new Date() : undefined
            })
            .where(eq(refunds.stripeRefundId, stripeRefundId))
            .returning();

         if (updatedRefund.length === 0) {
            throw new Error('Refund not found');
         }

         // Notify order service about refund completion
         if (status === 'succeeded') {
            await this.notifyOrderService(
               updatedRefund[0].orderId,
               'refund_completed',
               parseFloat(updatedRefund[0].amount)
            );

            // Send notification to customer
            await this.notifyNotificationService({
               type: 'refund_completed',
               orderId: updatedRefund[0].orderId,
               amount: parseFloat(updatedRefund[0].amount),
            });
         }

         return updatedRefund[0];
      } catch (error) {
         throw new Error(`Failed to update refund status: ${error}`);
      }
   }

   // process automatic refund (for cancelled orders)
   async processAutomaticRefund(orderId: string, reason: "customer_request" | "restaurant_cancelled" | "driver_unavailable" | "food_quality" | "other") {
      try {
         const payment = await this.db.select()
            .from(payments)
            .where(eq(payments.orderId, orderId))
            .limit(1);

         if (!payment[0] || payment[0].status !== 'succeeded') {
            return null;   // no refund needed
         }

         // fetch customer details
         let customerEmail = '';
         try {
            const customerResponse = await fetch(`http://localhost:3001/api/users/${payment[0].userId}`);
            if (customerResponse.ok) {
               const customerData = await customerResponse.json();
               customerEmail = customerData.data?.user?.email || '';
            }
         } catch (error) {
            console.warn('Failed to fetch customer details:', error);
         }

         const refundRequest: CreateRefundRequest = {
            orderId: orderId,
            reason: reason as any,
            description: `Automatic refund due to ${reason}`,
            requestedBy: payment[0].userId
         }

         const result = await this.createRefund(refundRequest);
         return {
            refund: result,
            customerEmail,
            refundAmount: result.amount
         }
      } catch (error) {
         throw new Error(`Failed to process automatic refund: ${error}`);
      }
   }

   // get refund statistics
   async getRefundStats(
      restaurantId?: string,
      dateFrom?: Date,
      dateTo?: Date
   ): Promise<RefundStatsResponse> {
      try {
         const allRefunds = await this.db.select().from(refunds);

         const totalRefunds = allRefunds.length;
         const successfulRefunds = allRefunds.filter(r => r.status === 'succeeded').length;
         const totalRefundAmount = allRefunds.filter(r => r.status === 'succeeded')
            .reduce((sum, r) => sum + parseFloat(r.amount), 0);

         return {
            totalRefunds,
            successfulRefunds,
            totalRefundAmount: sanitizeAmount(totalRefundAmount),
            refundRate: totalRefunds > 0 ? (successfulRefunds / totalRefunds) * 100 : 0
         }
      } catch (error) {
         throw new Error(`Failed to get refund stats: ${error}`);
      }
   }

   // Notify order service
   private async notifyOrderService(orderId: string, event: string, amount?: number) {
      try {
         await fetch(`${process.env.ORDER_SERVICE_URL}/api/orders/${orderId}/refund-status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               event,
               amount: amount ? sanitizeAmount(amount) : 0,
               timestamp: new Date().toISOString()
            }),
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

   private mapToStripeReason(reason: string): 'duplicate' | 'fraudulent' | 'requested_by_customer' {
      const reasonMap: Record<string, 'duplicate' | 'fraudulent' | 'requested_by_customer'> = {
         'customer_request': 'requested_by_customer',
         'restaurant_cancelled': 'requested_by_customer',
         'driver_unavailable': 'requested_by_customer',
         'food_quality': 'requested_by_customer',
         'other': 'requested_by_customer'
      };

      return reasonMap[reason] || 'requested_by_customer';
   }
}