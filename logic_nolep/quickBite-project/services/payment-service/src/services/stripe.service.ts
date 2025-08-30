import { stripe } from "../config/stripe";
import type Stripe from "stripe";

export class StripeService {
   private stripe: Stripe;

   constructor(stripeInstance?: Stripe) {
      this.stripe = stripeInstance || stripe;
   }

   async createPaymentIntent(
      amount: number,
      currency: string = 'USD',
      metadata: Record<string, string> = {}
   ): Promise<Stripe.PaymentIntent> {
      try {
         const paymentIntent = await this.stripe.paymentIntents.create({
            amount: Math.round(amount * 100),   // convert to cents
            currency: currency.toLowerCase(),
            metadata,
            automatic_payment_methods: {
               enabled: true
            }
         });

         return paymentIntent;
      } catch (error) {
         throw new Error(`Failed to create payment intent: ${error}`);
      }
   }

   async createCheckoutSession(
      amount: number,
      currency: string = 'USD',
      metadata: Record<string, string> = {},
      successUrl: string,
      cancelUrl: string,
      customerEmail?: string
   ): Promise<Stripe.Checkout.Session> {
      try {
         const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
               {
                  price_data: {
                     currency: currency.toLowerCase(),
                     product_data: {
                        name: 'Order Payment',
                        description: `Payment for order ${metadata.orderId || 'N/A'}`,
                     },
                     unit_amount: Math.round(amount * 100), // convert to cents
                  },
                  quantity: 1,
               },
            ],
            mode: 'payment',
            success_url: successUrl,
            cancel_url: cancelUrl,
            customer_email: customerEmail,
            metadata,
            expires_at: Math.floor(Date.now() / 1000) + (30 * 60), // 30 minutes expiry
            payment_intent_data: {
               metadata,
               description: `Payment for order ${metadata.orderId || 'N/A'}`
            },
         });

         return session;
      } catch (error) {
         throw new Error(`Failed to create checkout session: ${error}`);
      }
   }

   async createPaymentLink(
      amount: number,
      currency: string = 'USD',
      metadata: Record<string, string> = {}
   ): Promise<Stripe.PaymentLink> {
      try {
         // First create a product
         const product = await this.stripe.products.create({
            name: 'Order Payment',
            description: `Payment for order ${metadata.orderId || 'N/A'}`,
            metadata,
         });

         // Then create a price for the product
         const price = await this.stripe.prices.create({
            unit_amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            product: product.id,
         });

         // Finally create the payment link
         const paymentLink = await this.stripe.paymentLinks.create({
            line_items: [
               {
                  price: price.id,
                  quantity: 1,
               },
            ],
            metadata,
         });

         return paymentLink;
      } catch (error) {
         throw new Error(`Failed to create payment link: ${error}`);
      }
   }

   async createPaymentLinkWithPrice(
      priceId: string,
      metadata: Record<string, string> = {}
   ): Promise<Stripe.PaymentLink> {
      try {
         const paymentLink = await this.stripe.paymentLinks.create({
            line_items: [
               {
                  price: priceId,
                  quantity: 1,
               },
            ],
            metadata,
         });

         return paymentLink;
      } catch (error) {
         throw new Error(`Failed to create payment link with price: ${error}`);
      }
   }

   async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
      try {
         const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
         return paymentIntent;
      } catch (error) {
         throw new Error(`Failed to confirm payment: ${error}`);
      }
   }

   async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
      try {
         const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
         return paymentIntent;
      } catch (error) {
         throw new Error(`Failed to get payment intent: ${error}`);
      }
   }

   async createRefund(
      paymentIntentId: string,
      amount?: number,
      reason?: string,
      metadata: Record<string, string> = {}
   ): Promise<Stripe.Refund> {
      try {
         const refundData: Stripe.RefundCreateParams = {
            payment_intent: paymentIntentId,
            metadata
         };

         if (amount) {
            refundData.amount = Math.round(amount * 100);
         }

         if (reason) {
            refundData.reason = reason as Stripe.RefundCreateParams.Reason;
         }

         const refund = await this.stripe.refunds.create(refundData);
         return refund;
      } catch (error) {
         throw new Error(`Failed to create refund: ${error}`);
      }
   }

   async getRefund(refundId: string): Promise<Stripe.Refund> {
      try {
         const refund = await this.stripe.refunds.retrieve(refundId);
         return refund;
      } catch (error) {
         throw new Error(`Failed to get refund: ${error}`);
      }
   }

   // create transfer (for driver payouts or restaurant settlements)
   async createTransfer(
      amount: number,
      destination: string, // stripe connect account ID
      currency: string = 'USD',
      metadata: Record<string, string> = {}
   ): Promise<Stripe.Transfer> {
      try {
         const transfer = await this.stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: currency.toLowerCase(),
            destination,
            metadata
         });

         return transfer;
      } catch (error) {
         throw new Error(`Failed to create transfer: ${error}`);
      }
   }

   async verifyWebHookSignature(
      payload: string,
      signature: string,
      secret: string
   ): Promise<Stripe.Event> {
      try {
         return this.stripe.webhooks.constructEventAsync(payload, signature, secret);
      } catch (error) {
         throw new Error(`Webhook signature verification failed: ${error}`);
      }
   }

   calculateApplicationFee(amount: number, feeRate: number): number {
      return Math.round(amount * feeRate * 100);
   }
}