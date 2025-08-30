import { db } from "../db/client";
import { notificationTemplates } from "../db/schema";

export const seedNotificationTemplates = async () => {
   const templates = [
      {
         templateKey: 'order.confirmation',
         templateType: 'email' as const,
         subject: 'Order Confirmation - {{orderNumber}}',
         content: `
         <h2>Thank you for your order!</h2>
        <p>Hi {{customerName}},</p>
        <p>Your order <strong>{{orderNumber}}</strong> has been confirmed.</p>
        <div>
          <h3>Order Details:</h3>
          <ul>
            {{#each items}}
            <li>{{name}} x {{quantity}} - Rp {{price}}</li>
            {{/each}}
          </ul>
          <p><strong>Total: Rp {{totalAmount}}</strong></p>
        </div>
        <p>Restaurant: {{restaurantName}}</p>
        <p>Delivery Address: {{deliveryAddress}}</p>
        <p>Estimated delivery: {{estimatedDeliveryTime}}</p>
        <p>Thank you for using QuickBite!</p>
         `,
         variables: ['customerName', 'orderNumber', 'items', 'totalAmount', 'restaurantName', 'deliveryAddress', 'estimatedDeliveryTime']
      },
      {
         templateKey: 'order.cancelled',
         templateType: 'email' as const,
         subject: 'Order Cancelled - {{orderNumber}}',
         content: `
         <h2>Order Cancelled</h2>
        <p>Hi {{customerName}},</p>
        <p>Your order <strong>{{orderNumber}}</strong> has been cancelled.</p>
        <p>Reason: {{cancellationReason}}</p>
        <p>Refund amount: Rp {{refundAmount}}</p>
        <p>The refund will be processed within 3-5 business days.</p>
        <p>We apologize for any inconvenience.</p>
         `,
         variables: ['customerName', 'orderNumber', 'cancellationReason', 'refundAmount']
      },
      {
         templateKey: 'payment.received',
         templateType: 'email' as const,
         subject: 'Payment Confirmation - {{orderNumber}}',
         content: `
         <h2>Payment Received</h2>
        <p>Hi {{customerName}},</p>
        <p>We have received your payment for order <strong>{{orderNumber}}</strong>.</p>
        <p>Amount paid: Rp {{paidAmount}}</p>
        <p>Payment method: {{paymentMethod}}</p>
        <p>Your order is now being prepared!</p>
         `,
         variables: ['customerName', 'orderNumber', 'paidAmount', 'paymentMethod']
      },
      {
         templateKey: 'delivery.status',
         templateType: 'email' as const,
         subject: 'Delivery Update - {{orderNumber}}',
         content: `
         <h2>Delivery Status Update</h2>
        <p>Hi {{customerName}},</p>
        <p>Your order <strong>{{orderNumber}}</strong> status: <strong>{{status}}</strong></p>
        {{#if driverName}}
        <p>Driver: {{driverName}}</p>
        <p>Driver phone: {{driverPhone}}</p>
        {{/if}}
        {{#if estimatedArrival}}
        <p>Estimated arrival: {{estimatedArrival}}</p>
        {{/if}}
        <p>Track your order in the app for real-time updates.</p>
         `,
         variables: ['customerName', 'orderNumber', 'status', 'driverName', 'driverPhone', 'estimatedArrival']
      },
      {
         templateKey: 'refund.process',
         templateType: 'email' as const,
         subject: 'Refund processed - {{orderNumber}}',
         content: `
         <h2>Refund Processed</h2>
        <p>Hi {{customerName}},</p>
        <p>Your refund for order <strong>{{orderNumber}}</strong> has been processed.</p>
        <p>Refund amount: Rp {{refundAmount}}</p>
        <p>Refund method: {{refundMethod}}</p>
        <p>The amount will reflect in your account within 3-5 business days.</p>
        <p>Thank you for your understanding.</p>
         `,
         variables: ['customerName', 'orderNumber', 'refundAmount', 'refundMethod']
      }
   ];

   for (const template of templates) {
      await db.insert(notificationTemplates)
         .values(template)
         .onConflictDoNothing();
   }

   console.log('✅ Notification templates seeded');
}