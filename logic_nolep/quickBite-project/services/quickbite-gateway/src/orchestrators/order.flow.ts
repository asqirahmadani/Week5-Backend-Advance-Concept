import { logger } from "@/middleware/logger";
import { BaseOrchestrator } from "./base.orchestrator";
import type { OrchestrationStep, OrderOrchestrationData } from "@/types";

interface CreateOrderRequest {
   restaurantId: string;
   items: Array<{
      menuItemId: string;
      quantity: number;
   }>;
   deliveryAddress: string;
   specialInstruction?: string;
}

export class OrderFlowOrchestrator extends BaseOrchestrator {
   async createOrder(
      userId: string,
      userEmail: string,
      userRole: string,
      orderData: CreateOrderRequest
   ): Promise<{
      success: boolean;
      data?: OrderOrchestrationData;
      error?: string;
      transactionId: string;
   }> {
      const steps: OrchestrationStep[] = [
         {
            stepName: 'create_order',
            service: 'order',
            endpoint: '/api/orders',
            method: 'POST',
            payload: {
               ...orderData
            },
            compensationEndpoint: '/api/orders/{{orderId}}/cancel',
            compensationMethod: 'PATCH',
            compensationPayload: {
               reason: 'System error during order creation'
            }
         },
         {
            stepName: 'create_payment',
            service: 'payment',
            endpoint: '/api/payments/create-checkout',
            method: 'POST',
            payload: {
               orderId: '{{orderId}}',
               amount: '{{totalAmount}}',
               currency: 'USD',
               paymentMethod: 'card'
            },
            compensationEndpoint: '/api/payments/{{sessionId}}/cancel',
            compensationMethod: 'PATCH',
            compensationPayload: {}
         },
         {
            stepName: 'queue_notification',
            service: 'notification',
            endpoint: '/api/notifications/send',
            method: 'POST',
            payload: {
               templateKey: 'payment_pending',
               notificationType: 'email',
               recipient: '{{userEmail}}',
               variables: {
                  orderId: '{{orderId}}',
                  paymentLink: '{{paymentLink}}',
                  totalAmount: '{{totalAmount}}'
               }
            }
         },
         {
            stepName: 'send_notification',
            service: 'notification',
            endpoint: '/api/notifications/process',
            method: 'POST'
         }
      ];

      const context = this.createContext(userId, userEmail, userRole, steps);
      const orchestrationData: OrderOrchestrationData = {};

      logger.info({
         transactionId: context.transactionId,
         userId,
         orderData
      }, 'Starting order creation orchestration');

      try {
         // Step 1: Create Order
         const orderResult = await this.executeStep(steps[0], context, orderData);
         orchestrationData.orderId = orderResult.order.id;

         // Step 2: Create Payment Intent
         const paymentResult = await this.executeStep(steps[1], context, {
            orderId: orderResult.order.id,
            totalAmount: orderResult.order.totalAmount
         });
         orchestrationData.sessionId = paymentResult.sessionId;
         orchestrationData.paymentLink = paymentResult.paymentUrl;

         // Step 3: Queue Payment Notification
         const notificationResult = await this.executeStep(steps[2], context, {
            userEmail,
            orderId: orderResult.order.id,
            paymentLink: paymentResult.paymentUrl,
            totalAmount: orderResult.order.totalAmount,
            customerName: orderResult.order.customerName
         });

         // Step 4: Send Payment Notification
         const sendNotification = await this.executeStep(steps[3], context);
         orchestrationData.notificationIds = [notificationResult.notificationId];

         logger.info({
            transactionId: context.transactionId,
            orchestrationData
         }, 'Order creation orchestration completed successfully');

         return {
            success: true,
            data: orchestrationData,
            transactionId: context.transactionId
         };
      } catch (error: any) {
         await this.handleOrchestrationFailure(context, error.stepName || 'unknown', error);

         return {
            success: false,
            error: `Order creation failed: ${error.message}`,
            transactionId: context.transactionId
         };
      }
   }

   async acceptOrderByDriver(
      driverId: string,
      userEmail: string,
      userRole: string,
      orderId: string
   ): Promise<{
      success: boolean;
      data?: any;
      error?: string;
      transactionId: string;
   }> {
      const steps: OrchestrationStep[] = [
         {
            stepName: 'update_order_status',
            service: 'order',
            endpoint: `/api/orders/${orderId}/accept`,
            method: 'POST',
            payload: {},
            compensationEndpoint: `/api/orders/${orderId}/accept`,
            compensationMethod: 'POST',
            compensationPayload: {
               status: 'pending'
            }
         },
         {
            stepName: 'assign_delivery',
            service: 'delivery',
            endpoint: '/api/deliveries/assign-driver',
            method: 'POST',
            payload: {
               orderId: orderId,
               customerId: '{{customerId}}',
               restaurantId: '{{restaurantId}}',
               deliveryAddress: '{{deliveryAddress}}'
            },
            compensationEndpoint: '/api/deliveries/{{deliveryId}}/cancel',
            compensationMethod: 'PATCH',
            compensationPayload: {}
         },
         {
            stepName: 'notify_customer',
            service: 'notification',
            endpoint: '/api/notifications/send',
            method: 'POST',
            payload: {
               templateKey: 'driver_assigned',
               notificationType: 'email',
               recipient: '{{customerEmail}}',
               variables: {
                  orderId: orderId,
                  driverName: '{{driverName}}',
                  estimatedArrival: '{{estimatedArrival}}'
               }
            }
         },
         {
            stepName: 'notify_restaurant',
            service: 'notification',
            endpoint: '/api/notifications/send',
            method: 'POST',
            payload: {
               templateKey: 'email.order.preparation_start',
               notificationType: 'email',
               recipient: '{{restaurantEmail}}',
               variables: {
                  orderId: orderId,
                  driverName: '{{driverName}}'
               }
            }
         }
      ];

      const context = this.createContext(driverId, userEmail, userRole, steps);

      try {
         // Step 1: Update order status
         const orderResult = await this.executeStep(steps[0], context, {});

         // Step 2: Assign delivery
         const deliveryResult = await this.executeStep(steps[1], context, {
            restaurantId: orderResult.order.restaurantId,
            customerId: orderResult.order.customerId,
            deliveryAddress: orderResult.order.deliveryAddress
         });

         // Step 3: Notify customer
         await this.executeStep(steps[2], context, {
            customerEmail: orderResult.customerEmail,
            driverName: orderResult.driverName,
            estimatedArrival: orderResult.order.estimatedDeliveryTime
         });

         // Step 4: Notify restaurant
         await this.executeStep(steps[3], context, {
            restaurantEmail: orderResult.restaurantEmail,
            driverName: orderResult.driverName
         });

         return {
            success: true,
            data: {
               orderId,
               deliveryId: deliveryResult.id,
               driverId
            },
            transactionId: context.transactionId
         };
      } catch (error: any) {
         await this.handleOrchestrationFailure(context, error.stepName || 'unknown', error);

         return {
            success: false,
            error: `Driver assignment failed: ${error.message}`,
            transactionId: context.transactionId
         };
      }
   }

   async cancelOrder(
      userId: string,
      userEmail: string,
      userRole: string,
      orderId: string,
      reason: string
   ): Promise<{
      success: boolean;
      data?: any;
      error?: string;
      transactionId: string;
   }> {
      const steps: OrchestrationStep[] = [
         {
            stepName: 'update_order_status',
            service: 'order',
            endpoint: `/api/orders/${orderId}/status`,
            method: 'PATCH',
            payload: {
               status: 'cancelled',
               notes: reason
            }
         },
         {
            stepName: 'process_refund',
            service: 'payment',
            endpoint: '/api/refunds/auto-refund',
            method: 'POST',
            payload: {
               orderId: orderId,
               reason: reason
            }
         },
         {
            stepName: 'send_cancellation_notification',
            service: 'notification',
            endpoint: '/api/notifications/send',
            method: 'POST',
            payload: {
               templateKey: 'order.cancelled',
               notificationType: 'email',
               recipient: '{{customerEmail}}',
               variables: {
                  orderId: orderId,
                  reason: reason,
                  refundAmount: '{{refundAmount}}'
               }
            }
         }
      ];

      const context = this.createContext(userId, userEmail, userRole, steps);

      try {
         // Step 1: Update order status
         const orderResult = await this.executeStep(steps[0], context, {});

         // Step 2: Process refund if payment was made
         let refundResult = null;
         if (orderResult.order.paymentStatus === 'paid') {
            refundResult = await this.executeStep(steps[1], context, {});
         } else {
            throw new Error(`Failed to create refund, order payment status: ${orderResult.order.paymentStatus}`);
         }

         // Step 3: Send notification
         await this.executeStep(steps[2], context, {
            customerEmail: refundResult.customerEmail,
            refundAmount: refundResult?.refundAmount || null
         });

         return {
            success: true,
            data: {
               orderId,
               cancelled: true,
               refundAmount: refundResult?.refundAmount || 0
            },
            transactionId: context.transactionId
         };
      } catch (error: any) {
         await this.handleOrchestrationFailure(context, error.stepName || 'unknown', error);

         return {
            success: false,
            error: `Order cancellation failed: ${error.message}`,
            transactionId: context.transactionId
         };
      }
   }
}