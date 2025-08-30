import { orders, orderItems, orderStatusHistory } from "../db/schema";
import { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;
export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;
export type OrderStatusHistory = InferSelectModel<typeof orderStatusHistory>;

export type OrderStatus =
   | 'pending'
   | 'confirmed'
   | 'preparing'
   | 'ready'
   | 'picked_up'
   | 'delivered'
   | 'cancelled'

export type PaymentStatus =
   | 'pending'
   | 'paid'
   | 'refunded'
   | 'failed'

export interface CreateOrderData {
   customerId: string;
   restaurantId: string;
   items: Array<{
      menuItemId: string;
      quantity: number;
   }>
   deliveryAddress: string;
   deliveryFee?: string;   // decimal as string
}

export interface UpdateOrderStatusData {
   status: OrderStatus;
   driverId?: string;
   estimatedDeliveryTime?: Date;
   actualDeliveryTime?: Date;
   notes?: string;
   paymentStatus?: PaymentStatus
}

export interface OrderWithItems extends Order {
   items: OrderItem[];
}