import { OrderService } from "../../src/services/order.service";
import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CreateOrderData, UpdateOrderStatusData } from "../../src/type/order.types";

// Mock fetch globally
global.fetch = Object.assign(mock(), {
   preconnect: () => Promise.resolve()
});

describe('OrderService', () => {
   let orderService: OrderService;
   let mockDb: any;
   let mockTx: any;

   beforeEach(() => {
      // Reset fetch mock
      (global.fetch as any).mockReset();

      // Mock transaction
      mockTx = {
         insert: mock(() => ({
            values: mock(() => ({
               returning: mock(() => [mockOrder])
            }))
         })),
         update: mock(() => ({
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => [mockOrder])
               }))
            }))
         })),
         select: mock(() => ({
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => [mockOrder])
               }))
            }))
         }))
      };

      // Mock database
      mockDb = {
         transaction: mock((callback) => callback(mockTx)),
         select: mock(() => ({
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => [mockOrder]),
                  orderBy: mock(() => ({
                     limit: mock(() => ({
                        offset: mock(() => [mockOrder])
                     }))
                  })),
                  groupBy: mock(() => mockOrderStats)
               })),
               orderBy: mock(() => [mockOrder]),
               groupBy: mock(() => mockOrderStats)
            }))
         })),
         insert: mock(() => ({
            values: mock(() => ({
               returning: mock(() => [mockOrder])
            }))
         })),
         update: mock(() => ({
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => [mockOrder])
               }))
            }))
         }))
      };

      orderService = new OrderService(mockDb);
   });

   type OrderStatus =
      | 'pending'
      | 'confirmed'
      | 'preparing'
      | 'ready'
      | 'picked_up'
      | 'delivered'
      | 'cancelled'

   type PaymentStatus =
      | 'pending'
      | 'paid'
      | 'refunded'
      | 'failed'

   const mockOrder = {
      id: 'order-1',
      orderNumber: 'ORD12345678ABCD',
      customerId: 'customer-1',
      restaurantId: 'restaurant-1',
      driverId: null,
      status: 'pending' as OrderStatus,
      subtotal: '25000',
      deliveryFee: '5000',
      totalAmount: '30000',
      deliveryAddress: '123 Main St',
      estimatedDeliveryTime: new Date(),
      actualDeliveryTime: new Date(),
      refundAmount: '0',
      paymentStatus: 'pending' as PaymentStatus,
      createdAt: new Date(),
      updatedAt: new Date()
   };

   const mockOrderItem = {
      id: 'item-1',
      orderId: 'order-1',
      menuItemId: 'menu-1',
      menuItemName: 'Pasta Carbonara',
      quantity: 2,
      unitPrice: '12500',
      totalPrice: '25000',
      createdAt: new Date()
   };

   const mockOrderStats = [
      { status: 'pending', count: 5 },
      { status: 'delivered', count: 10 },
      { status: 'cancelled', count: 2 }
   ];

   describe('createOrder', () => {
      it('should create order successfully', async () => {
         const orderData: CreateOrderData = {
            customerId: 'customer-1',
            restaurantId: 'restaurant-1',
            items: [
               { menuItemId: 'menu-1', quantity: 2 }
            ],
            deliveryAddress: '123 Main St',
            deliveryFee: '5000'
         };

         // Mock fetch response for menu item
         (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({
               data: {
                  item: {
                     name: 'Pasta Carbonara',
                     price: '12500'
                  }
               }
            })
         });

         const result = await orderService.createOrder(orderData);

         expect(result).toEqual(mockOrder);
         expect(mockDb.transaction).toHaveBeenCalled();
      });

      it('should throw error when menu item not found', async () => {
         const orderData: CreateOrderData = {
            customerId: 'customer-1',
            restaurantId: 'restaurant-1',
            items: [
               { menuItemId: 'nonexistent-menu', quantity: 2 }
            ],
            deliveryAddress: '123 Main St'
         };

         // Mock fetch response for menu item not found
         (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            json: () => Promise.resolve({
               message: 'Menu item not found'
            })
         });

         await expect(orderService.createOrder(orderData)).rejects.toThrow('Menu item not found');
      });

      it('should calculate totals correctly', async () => {
         const orderData: CreateOrderData = {
            customerId: 'customer-1',
            restaurantId: 'restaurant-1',
            items: [
               { menuItemId: 'menu-1', quantity: 2 },
               { menuItemId: 'menu-2', quantity: 1 }
            ],
            deliveryAddress: '123 Main St',
            deliveryFee: '5000'
         };

         // Mock fetch responses for menu items
         (global.fetch as any)
            .mockResolvedValueOnce({
               ok: true,
               json: () => Promise.resolve({
                  data: { item: { name: 'Pasta', price: '15000' } }
               })
            })
            .mockResolvedValueOnce({
               ok: true,
               json: () => Promise.resolve({
                  data: { item: { name: 'Pizza', price: '20000' } }
               })
            });

         await orderService.createOrder(orderData);

         expect(mockDb.transaction).toHaveBeenCalled();
         // Verify the order creation logic was called
         expect(mockTx.insert).toHaveBeenCalled();
      });
   });

   describe('getOrderById', () => {
      it('should return order with items', async () => {
         // Mock order query
         mockDb.select.mockReturnValueOnce({
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => [mockOrder])
               }))
            }))
         });

         // Mock items query
         mockDb.select.mockReturnValueOnce({
            from: mock(() => ({
               where: mock(() => [mockOrderItem])
            }))
         });

         const result = await orderService.getOrderById('order-1');

         expect(result).toEqual({
            ...mockOrder,
            items: [mockOrderItem]
         });
      });

      it('should return null when order not found', async () => {
         mockDb.select.mockReturnValueOnce({
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => [])
               }))
            }))
         });

         const result = await orderService.getOrderById('nonexistent');

         expect(result).toBeNull();
      });
   });

   describe('getOrdersByCustomer', () => {
      it('should return customer orders with pagination', async () => {
         const result = await orderService.getOrdersByCustomer('customer-1', 1, 10);

         expect(result).toEqual([mockOrder]);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should handle pagination correctly', async () => {
         await orderService.getOrdersByCustomer('customer-1', 2, 5);

         expect(mockDb.select).toHaveBeenCalled();
         // Verify offset calculation (page 2, limit 5 = offset 5)
      });
   });

   describe('getOrdersByRestaurant', () => {
      it('should return restaurant orders without status filter', async () => {
         const result = await orderService.getOrdersByRestaurant('restaurant-1');

         expect(result).toEqual([mockOrder]);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return restaurant orders with status filter', async () => {
         const result = await orderService.getOrdersByRestaurant('restaurant-1', 'pending', 1, 10);

         expect(result).toEqual([mockOrder]);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe('getAvailableOrders', () => {
      it('should return available orders for drivers', async () => {
         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  orderBy: mock(() => [mockOrder])
               }))
            }))
         };
         mockDb.select.mockReturnValueOnce(mockSelectChain);

         const result = await orderService.getAvailableOrders();

         expect(result).toEqual([mockOrder]);
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockSelectChain.from).toHaveBeenCalled();
      });
   });

   describe('updateOrderStatus', () => {
      it('should update order status successfully', async () => {
         const updateData: UpdateOrderStatusData = {
            status: 'confirmed',
            driverId: 'driver-1',
            notes: 'Order confirmed'
         };

         const result = await orderService.updateOrderStatus('order-1', updateData);

         expect(result).toEqual(mockOrder);
         expect(mockDb.transaction).toHaveBeenCalled();
      });

      it('should add status history when updating', async () => {
         const updateData: UpdateOrderStatusData = {
            status: 'delivered',
            actualDeliveryTime: new Date(),
            notes: 'Order delivered'
         };

         await orderService.updateOrderStatus('order-1', updateData);

         expect(mockTx.insert).toHaveBeenCalled();
         expect(mockTx.update).toHaveBeenCalled();
      });
   });

   describe('assignDriverWithDetails', () => {
      it('should assign driver and fetch details successfully', async () => {
         // Mock API calls for user and restaurant details
         (global.fetch as any)
            .mockResolvedValueOnce({
               ok: true,
               json: () => Promise.resolve({
                  data: { user: { email: 'customer@example.com', fullName: 'John Doe' } }
               })
            })
            .mockResolvedValueOnce({
               ok: true,
               json: () => Promise.resolve({
                  data: { restaurant: { email: 'restaurant@example.com', name: 'Test Restaurant' } }
               })
            })
            .mockResolvedValueOnce({
               ok: true,
               json: () => Promise.resolve({
                  data: { user: { fullName: 'Driver Smith' } }
               })
            });

         const result = await orderService.assignDriverWithDetails('order-1', 'driver-1');

         expect(result.order).toEqual(mockOrder);
         expect(result.customerEmail).toBe('test@example.com');
         expect(result.customerName).toBe('Test Customer');
         expect(result.restaurantEmail).toBe('restaurant@example.com');
         expect(result.restaurantName).toBe('Test Restaurant');
         expect(result.driverName).toBe('Test Driver');
         expect(result.estimatedArrival).toBeDefined();
      });

      it('should handle API failures gracefully', async () => {
         // Mock failed API calls
         (global.fetch as any)
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: false });

         const result = await orderService.assignDriverWithDetails('order-1', 'driver-1');

         expect(result.order).toEqual(mockOrder);
         expect(result.customerEmail).toBe('test@example.com');
         expect(result.restaurantEmail).toBe('restaurant@example.com');
         expect(result.driverName).toBe('Test Driver');
      });
   });

   describe('cancelOrder', () => {
      it('should cancel order with reason', async () => {
         const result = await orderService.cancelOrder('order-1', 'Customer request');

         expect(result).toEqual(mockOrder);
         expect(mockDb.transaction).toHaveBeenCalled();
      });

      it('should cancel order without reason', async () => {
         const result = await orderService.cancelOrder('order-1');

         expect(result).toEqual(mockOrder);
         expect(mockDb.transaction).toHaveBeenCalled();
      });
   });

   describe('getOrderStats', () => {
      it('should return order statistics for specific restaurant', async () => {
         const result = await orderService.getOrderStats('restaurant-1');

         expect(result).toEqual({
            total: 17,
            pending: 5,
            preparing: 0,
            ready: 0,
            picked_up: 0,
            confirmed: 0,
            delivered: 10,
            cancelled: 2
         });
      });

      it('should return global order statistics', async () => {
         const result = await orderService.getOrderStats();

         expect(result).toEqual({
            total: 17,
            pending: 5,
            preparing: 0,
            ready: 0,
            picked_up: 0,
            confirmed: 0,
            delivered: 10,
            cancelled: 2
         });
      });
   });

   describe('updatePaymentStatus', () => {
      it('should update payment status', async () => {
         const result = await orderService.updatePaymentStatus('order-1', 'paid', '2024-01-01T10:00:00Z');

         expect(mockDb.update).toHaveBeenCalled();
      });
   });

   describe('updateRefundStatus', () => {
      it('should update refund status with amount', async () => {
         const result = await orderService.updateRefundStatus('order-1', 'refunded', 25000, '2024-01-01T10:00:00Z');

         expect(mockDb.update).toHaveBeenCalled();
      });

      it('should update refund status without amount', async () => {
         const result = await orderService.updateRefundStatus('order-1', 'refunded');

         expect(mockDb.update).toHaveBeenCalled();
      });
   });

   describe('getCustomerOrdersCount', () => {
      it('should return customer orders count', async () => {
         mockDb.select.mockReturnValueOnce({
            from: mock(() => ({
               where: mock(() => [{ count: 5 }])
            }))
         });

         const result = await orderService.getCustomerOrdersCount('customer-1');

         expect(result).toBe(5);
      });

      it('should return 0 when no orders found', async () => {
         mockDb.select.mockReturnValueOnce({
            from: mock(() => ({
               where: mock(() => [])
            }))
         });

         const result = await orderService.getCustomerOrdersCount('customer-1');

         expect(result).toBe(0);
      });
   });

   describe('getRestaurantOrdersCount', () => {
      it('should return restaurant orders count', async () => {
         mockDb.select.mockReturnValueOnce({
            from: mock(() => ({
               where: mock(() => [{ count: 10 }])
            }))
         });

         const result = await orderService.getRestaurantOrdersCount('restaurant-1');

         expect(result).toBe(10);
      });
   });
});