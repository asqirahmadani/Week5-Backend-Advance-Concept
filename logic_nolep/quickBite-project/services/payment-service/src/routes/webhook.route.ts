import { Elysia, t } from 'elysia';
import { StripeService } from '../services/stripe.service';
import { RefundService } from '../services/refund.service';
import { PaymentService } from '../services/payment.service';
import { errorResponse, successResponse } from '../utils/response';

// Define interfaces for dependency injection
export interface WebhookDependencies {
   stripeService: StripeService;
   refundService: RefundService;
   paymentService: PaymentService;
}

export class WebhookController {
   constructor(private dependencies: WebhookDependencies) { }

   async handleStripeWebhook(request: Request, set: any) {
      try {
         const signature = request.headers.get('stripe-signature');
         if (!signature) {
            return errorResponse('Missing Stripe signature');
         }

         const rawBody = await request.text();

         if (!process.env.STRIPE_WEBHOOK_SECRET) {
            console.error('❌ Missing STRIPE_WEBHOOK_SECRET');
            set.status = 500;
            return errorResponse('Webhook secret not configured');
         }

         // verify webhook signature
         const event = await this.dependencies.stripeService.verifyWebHookSignature(
            rawBody,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
         );

         // handle different event types
         switch (event.type) {
            case 'checkout.session.completed':
               await this.handleCheckoutSessionCompleted(event.data.object);
               break;

            case 'checkout.session.expired':
               await this.handleCheckoutSessionExpired(event.data.object);
               break;

            case 'payment_intent.succeeded':
               await this.handlePaymentIntentSucceeded(event.data.object);
               break;

            case 'payment_intent.payment_failed':
               await this.handlePaymentIntentFailed(event.data.object);
               break;

            case 'payment_intent.canceled':
               await this.handlePaymentIntentCanceled(event.data.object);
               break;

            case 'charge.dispute.created':
               await this.handleChargeDisputeCreated(event.data.object);
               break;

            case 'refund.created':
               await this.handleRefundCreated(event.data.object);
               break;

            case 'refund.updated':
               await this.handleRefundUpdated(event.data.object);
               break;

            case 'transfer.created':
               await this.handleTransferCreated(event.data.object);
               break;

            case 'transfer.updated':
               await this.handleTransferUpdated(event.data.object);
               break;

            case 'transfer.reversed':
               await this.handleTransferReversed(event.data.object);
               break;

            case 'payment_intent.created':
            case 'charge.succeeded':
            case 'charge.updated':
               console.log(`ℹ️ Ignoring event: ${event.type} (normal flow)`);
               break;

            default:
               console.log(`Unhandled event type: ${event.type}`);
         }

         return successResponse({ received: true });
      } catch (error) {
         console.error('Webhook error:', error);
         return errorResponse('Webhook processing failed');
      }
   }

   // handle checkout session completed (payment successful)
   private async handleCheckoutSessionCompleted(session: any) {
      try {
         const paymentIntentId = session.payment_intent;
         const sessionId = session.id;

         console.log(`🎉 Checkout Session Completed: ${sessionId}`);
         console.log(`💳 Payment Intent: ${paymentIntentId}`);

         if (paymentIntentId) {
            const result = await this.dependencies.paymentService.updatePaymentStatusBySessionId(
               sessionId,
               'succeeded',
               paymentIntentId
            );
            console.log(`✅ Payment updated via session: ${result?.id}`);
         } else {
            await this.dependencies.paymentService.updatePaymentStatusBySessionId(sessionId, 'succeeded');
         }

         const { orderId, userId } = session.metadata || {};
         if (orderId) {
            console.log(`📦 Order ${orderId} payment completed for user ${userId}`);
            console.log(`💰 Amount: ${session.amount_total / 100} ${session.currency?.toUpperCase()}`);
         }
      } catch (error) {
         console.error('Error handling checkout session completion:', error);
      }
   }

   private async handleCheckoutSessionExpired(session: any) {
      try {
         const sessionId = session.id;
         await this.dependencies.paymentService.updatePaymentStatusBySessionId(sessionId, 'cancelled');
         console.log(`Checkout session expired: ${sessionId}`);
      } catch (error) {
         console.error('Error handling checkout session expiration:', error);
      }
   }

   // payment intent succeeded
   private async handlePaymentIntentSucceeded(paymentIntent: any) {
      try {
         console.log(`💰 Payment Intent Succeeded: ${paymentIntent.id}`);

         const existingPayment = await this.dependencies.paymentService.getPaymentByIntentId(paymentIntent.id);

         if (existingPayment && existingPayment.status === 'succeeded') {
            console.log(`ℹ️ Payment ${paymentIntent.id} already processed by checkout session, skipping...`);
            return;
         }

         const result = await this.dependencies.paymentService.updatePaymentStatus(paymentIntent.id, 'succeeded');

         if (result) {
            const { orderId, userId } = paymentIntent.metadata || {};
            console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
            if (orderId) {
               console.log(`📦 Order ${orderId} payment completed for user ${userId}`);
            }
         }
      } catch (error) {
         console.error('Error handling payment success:', error);
      }
   }

   // payment intent failed
   private async handlePaymentIntentFailed(paymentIntent: any) {
      try {
         await this.dependencies.paymentService.updatePaymentStatus(paymentIntent.id, 'failed');
         console.log(`Payment failed: ${paymentIntent.id}`);
      } catch (error) {
         console.error('Error handling payment failure:', error);
      }
   }

   // Payment intent canceled
   private async handlePaymentIntentCanceled(paymentIntent: any) {
      try {
         await this.dependencies.paymentService.updatePaymentStatus(paymentIntent.id, 'cancelled');
         console.log(`Payment canceled: ${paymentIntent.id}`);
      } catch (error) {
         console.error('Error handling payment cancellation:', error);
      }
   }

   // Charge dispute created (chargeback)
   private async handleChargeDisputeCreated(dispute: any) {
      try {
         console.log(`Chargeback created for charge: ${dispute.charge}`);
         // Handle chargeback logic here
      } catch (error) {
         console.error('Error handling chargeback:', error);
      }
   }

   // Refund created
   private async handleRefundCreated(refund: any) {
      try {
         if (refund.status === 'succeeded') {
            await this.dependencies.refundService.updateRefundStatus(refund.id, 'succeeded');
         } else if (refund.status === 'failed') {
            await this.dependencies.refundService.updateRefundStatus(refund.id, 'failed');
         }
         console.log(`Refund created: ${refund.id}, status: ${refund.status}`);
      } catch (error) {
         console.error('Error handling refund creation:', error);
      }
   }

   // Refund updated
   private async handleRefundUpdated(refund: any) {
      try {
         await this.dependencies.refundService.updateRefundStatus(refund.id, refund.status);
         console.log(`Refund updated: ${refund.id}, status: ${refund.status}`);
      } catch (error) {
         console.error('Error handling refund update:', error);
      }
   }

   // Transfer created (when transfer is initiated)
   private async handleTransferCreated(transfer: any) {
      try {
         const { earningId, settlementId } = transfer.metadata;

         if (earningId) {
            console.log(`Driver payout initiated: ${earningId}`);
         }

         if (settlementId) {
            console.log(`Restaurant settlement initiated: ${settlementId}`);
         }
      } catch (error) {
         console.error('Error handling transfer creation:', error);
      }
   }

   // Transfer updated (when transfer status changes)
   private async handleTransferUpdated(transfer: any) {
      try {
         const { earningId, settlementId } = transfer.metadata;

         if (earningId) {
            if (transfer.reversed) {
               console.log(`Driver payout failed/reversed: ${earningId}`);
            } else {
               console.log(`Driver payout completed: ${earningId}`);
            }
         }

         if (settlementId) {
            if (transfer.reversed) {
               console.log(`Restaurant settlement failed/reversed: ${settlementId}`);
            } else {
               console.log(`Restaurant settlement completed: ${settlementId}`);
            }
         }
      } catch (error) {
         console.error('Error handling transfer update:', error);
      }
   }

   // Transfer reversed (when transfer is reversed/failed)
   private async handleTransferReversed(transfer: any) {
      try {
         const { earningId, settlementId } = transfer.metadata;

         if (earningId) {
            console.log(`Driver payout reversed: ${earningId}`);
         }

         if (settlementId) {
            console.log(`Restaurant settlement reversed: ${settlementId}`);
         }
      } catch (error) {
         console.error('Error handling transfer reversal:', error);
      }
   }
}

// Factory function to create webhook routes with injected dependencies
export function createWebhookRoutes(dependencies?: WebhookDependencies) {
   const deps = dependencies || {
      stripeService: new StripeService(),
      refundService: new RefundService(),
      paymentService: new PaymentService(),
   };

   const webhookController = new WebhookController(deps);

   return new Elysia({ prefix: '/webhooks' })
      .post('/post', async ({ request, set }) => {
         return webhookController.handleStripeWebhook(request, set);
      }, {
         detail: {
            summary: 'Stripe Webhook Handler',
            tags: ['Webhooks'],
         }
      });
}