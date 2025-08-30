import { t, type Static } from 'elysia';

export const createPaymentSchema = t.Object({
   orderId: t.String({ format: 'uuid' }),
   amount: t.Any({ minimum: 0.01 }),
   currency: t.Optional(t.String({ default: 'USD' })),
   paymentMethod: t.Union([
      t.Literal('card'),
      t.Literal('wallet'),
      t.Literal('cash')
   ]),
   successUrl: t.Optional(t.String({ format: 'uri' })),
   cancelUrl: t.Optional(t.String({ format: 'uri' })),
   metadata: t.Optional(t.Record(t.String(), t.Any())),
});

export const CreateCheckoutPaymentSchema = t.Object({
   orderId: t.String({ format: 'uuid' }),
   amount: t.Any({ minimum: 0.01 }),
   currency: t.Optional(t.String({ default: 'USD' })),
   paymentMethod: t.Union([
      t.Literal('card'),
      t.Literal('wallet'),
      t.Literal('cash')
   ]),
   successUrl: t.Optional(t.String({ format: 'uri' })),
   cancelUrl: t.Optional(t.String({ format: 'uri' })),
   metadata: t.Optional(t.Record(t.String(), t.Any()))
})

export const confirmPaymentSchema = t.Object({
   paymentIntentId: t.String({ minLength: 1 }),
});

export const createRefundSchema = t.Object({
   orderId: t.String({ format: 'uuid' }),
   amount: t.Optional(t.Number({ minimum: 0.01 })), // If not provided, refund full amount
   reason: t.Union([
      t.Literal('customer_request'),
      t.Literal('restaurant_cancelled'),
      t.Literal('driver_unavailable'),
      t.Literal('food_quality'),
      t.Literal('other')
   ]),
   description: t.Optional(t.String()),
   requestedBy: t.String({ format: 'uuid' }),
});

export const createDriverEarningSchema = t.Object({
   driverId: t.String({ format: 'uuid' }),
   orderId: t.String({ format: 'uuid' }),
   baseEarning: t.Number({ minimum: 0.01 }),
   tipAmount: t.Optional(t.Number({ minimum: 0, default: 0 })),
   bonusAmount: t.Optional(t.Number({ minimum: 0, default: 0 })),
});

export const createSettlementSchema = t.Object({
   restaurantId: t.String({ format: 'uuid' }),
   orderId: t.String({ format: 'uuid' }),
   grossAmount: t.Number({ minimum: 0.01 }),
   commissionRate: t.Number({ minimum: 0, maximum: 1 }), // 0 to 1 (0% to 100%)
});

export const stripeWebhookSchema = t.Object({
   id: t.String(),
   object: t.Literal('event'),
   type: t.String(),
   data: t.Object({
      object: t.Any(),
   }),
});

export const processPayoutSchema = t.Object({
   stripeAccountId: t.String({ minLength: 1 }),
});

export const refundStatsQuerySchema = t.Object({
   restaurantId: t.Optional(t.String({ format: 'uuid' })),
   dateFrom: t.Optional(t.String({ format: 'date' })),
   dateTo: t.Optional(t.String({ format: 'date' })),
});

export interface PaymentResponse {
   id: string;
   orderId: string;
   amount: number;
   status: string;
   clientSecret?: string;
   paymentIntentId?: string;
}

export interface RefundResponse {
   id: string;
   orderId: string;
   amount: number;
   status: string;
   refundId?: string;
}

export interface EarningResponse {
   id: string;
   driverId: string;
   orderId: string;
   totalEarning: number;
   status: string;
}

export interface SettlementResponse {
   id: string;
   restaurantId: string;
   orderId: string;
   netAmount: number;
   status: string;
}

export interface RefundStatsResponse {
   totalRefunds: number;
   successfulRefunds: number;
   totalRefundAmount: number;
   refundRate: number;
}

export interface OrderDetails {
   id: string;
   customerId: string;
   restaurantId: string;
   driverId?: string;
   totalAmount: number;
   status: string;
}

export type CreatePaymentRequest = Static<typeof createPaymentSchema>;
export type ConfirmPaymentRequest = Static<typeof confirmPaymentSchema>;
export type CreateRefundRequest = Static<typeof createRefundSchema>;
export type CreateDriverEarningRequest = Static<typeof createDriverEarningSchema>;
export type CreateSettlementRequest = Static<typeof createSettlementSchema>;
export type ProcessPayoutRequest = Static<typeof processPayoutSchema>;
export type RefundStatsQuery = Static<typeof refundStatsQuerySchema>;