import { describe, it, expect, beforeEach, mock } from "bun:test";
import { orderRoutes } from "../../src/routes/order.route";
import { Elysia } from "elysia";

// Set test environment
process.env.NODE_ENV = 'test';

describe('Order Routes', () => {
   let mockOrderService: any;
   let mockDb: any;

   beforeEach(() => {
      // Reset all mocks before each test
      mockOrderService = {
         createOrder: mock(),
         getOrderById: mock(),
         getOrdersByCustomer: mock(),
         getOrdersByRestaurant: mock(),
         getAvailableOrders: mock(),
         assignDriverWithDetails: mock(),
         cancelOrder: mock(),
         getOrderStats: mock(),
         updateOrderStatus: mock(),
         updatePaymentStatus: mock(),
         updateRefundStatus: mock(),
         getCustomerOrdersCount: mock(),
         getRestaurantOrdersCount: mock()
      };

      // Create comprehensive mock database with proper transaction support
      const createMockQuery = () => ({
         select: mock().mockReturnThis(),
         from: mock().mockReturnThis(),
         where: mock().mockReturnThis(),
         limit: mock().mockReturnThis(),
         offset: mock().mockReturnThis(),
         orderBy: mock().mockReturnThis(),
         insert: mock().mockReturnThis(),
         values: mock().mockReturnThis(),
         returning: mock().mockResolvedValue([]),
         update: mock().mockReturnThis(),
         set: mock().mockReturnThis(),
         groupBy: mock().mockResolvedValue([])
      });

      mockDb = {
         ...createMockQuery(),
         transaction: mock().mockImplementation(async (callback) => {
            const txMock = createMockQuery();
            return await callback(txMock);
         })
      };
   });

   // helper function to create app with mocked service
   const createApp = () => {
      return new Elysia()
         .derive(() => ({
            db: mockDb,
            orderService: mockOrderService
         }))
         .use(orderRoutes)
   };

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
      estimatedDeliveryTime: `${new Date()}`,
      actualDeliveryTime: `${new Date()}`,
      refundAmount: '0',
      paymentStatus: 'pending' as PaymentStatus,
      createdAt: `${new Date()}`,
      updatedAt: `${new Date()}`
   };

   describe('Public Routes', () => {
      describe('GET /:orderId', () => {
         it('should get restaurant orders with status filter and pagination', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByRestaurant.mockResolvedValue(mockOrders);
            mockOrderService.getRestaurantOrdersCount.mockResolvedValue(5);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/restaurant/restaurant-1?status=pending&page=2&limit=5')
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.data.pagination.page).toBe(2);
            expect(data.data.pagination.limit).toBe(5);
            expect(data.data.pagination.totalPages).toBe(1); // 5 total / 5 limit = 1 page
            expect(mockOrderService.getOrdersByRestaurant).toHaveBeenCalledWith(
               'restaurant-1', 'pending', 2, 5
            );
         });

         it('should return 404 when order not found', async () => {
            mockOrderService.getOrderById.mockResolvedValue(null);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/nonexistent')
            );

            expect(response.status).toBe(404);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Order not found');
         });

         it('should handle service error', async () => {
            mockOrderService.getOrderById.mockRejectedValue(new Error('Database error'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1')
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Database error');
         });
      });

      describe('GET /restaurant/:restaurantId', () => {
         it('should get restaurant orders successfully', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByRestaurant.mockResolvedValue(mockOrders);
            mockOrderService.getRestaurantOrdersCount.mockResolvedValue(1);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/restaurant/restaurant-1')
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.orders).toEqual(mockOrders);
            expect(data.data.pagination.total).toBe(1);
            expect(mockOrderService.getOrdersByRestaurant).toHaveBeenCalledWith(
               'restaurant-1', undefined, 1, 10
            );
         });

         it('should get restaurant orders with status filter and pagination', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByRestaurant.mockResolvedValue(mockOrders);
            mockOrderService.getRestaurantOrdersCount.mockResolvedValue(5);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/restaurant/restaurant-1?status=pending&page=2&limit=5')
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.data.pagination.page).toBe(2);
            expect(data.data.pagination.limit).toBe(5);
            expect(data.data.pagination.totalPages).toBe(1); // 5 total / 5 limit = 1 page
            expect(mockOrderService.getOrdersByRestaurant).toHaveBeenCalledWith(
               'restaurant-1', 'pending', 2, 5
            );
         });

         it('should handle service error', async () => {
            mockOrderService.getOrdersByRestaurant.mockRejectedValue(new Error('Database error'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/restaurant/restaurant-1')
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Database error');
         });

         it('should handle invalid pagination parameters', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByRestaurant.mockResolvedValue(mockOrders);
            mockOrderService.getRestaurantOrdersCount.mockResolvedValue(1);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/restaurant/restaurant-1?page=abc&limit=xyz')
            );

            expect(response.status).toBe(200);
            expect(mockOrderService.getOrdersByRestaurant).toHaveBeenCalledWith(
               'restaurant-1', undefined, 1, 10
            );
         });
      });

      describe('PATCH /:orderId/status', () => {
         it('should update order status successfully', async () => {
            const statusUpdateData = {
               status: 'confirmed',
               driverId: 'driver-1',
               estimatedDeliveryTime: 30,
               notes: 'Order confirmed'
            };

            const updatedOrder = { ...mockOrder, status: 'confirmed' };
            mockOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(statusUpdateData)
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Order status updated');
            expect(data.data.order).toEqual(updatedOrder);
         });

         it('should handle delivered status with actual delivery time', async () => {
            const statusUpdateData = {
               status: 'delivered'
            };

            const updatedOrder = { ...mockOrder, status: 'delivered' };
            mockOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(statusUpdateData)
               })
            );

            expect(response.status).toBe(200);
            expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
               'order-1',
               expect.objectContaining({
                  status: 'delivered',
                  actualDeliveryTime: expect.any(Date)
               })
            );
         });

         it('should handle estimated delivery time calculation', async () => {
            const statusUpdateData = {
               status: 'confirmed',
               estimatedDeliveryTime: 45
            };

            const updatedOrder = { ...mockOrder, status: 'confirmed' };
            mockOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

            const app = createApp();
            await app.handle(
               new Request('http://localhost/api/orders/order-1/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(statusUpdateData)
               })
            );

            expect(mockOrderService.updateOrderStatus).toHaveBeenCalledWith(
               'order-1',
               expect.objectContaining({
                  status: 'confirmed',
                  estimatedDeliveryTime: expect.any(Date)
               })
            );
         });

         it('should handle validation error for invalid status', async () => {
            const invalidData = {
               status: 'invalid_status'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422);
         });

         it('should handle validation error for invalid delivery time', async () => {
            const invalidData = {
               status: 'confirmed',
               estimatedDeliveryTime: 500 // exceeds maximum 480
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422);
         });

         it('should handle service error', async () => {
            mockOrderService.updateOrderStatus.mockRejectedValue(new Error('Order not found'));

            const statusUpdateData = { status: 'confirmed' };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/status', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(statusUpdateData)
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Order not found');
         });
      });

      describe('PUT /:orderId/payment-status', () => {
         it('should update payment status successfully', async () => {
            const paymentData = {
               event: 'paid',
               timestamp: '2024-01-01T10:00:00Z'
            };

            const updatedOrder = { ...mockOrder, paymentStatus: 'paid' };
            mockOrderService.updatePaymentStatus.mockResolvedValue(updatedOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/payment-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(paymentData)
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Payment status updated successfully');
            expect(mockOrderService.updatePaymentStatus).toHaveBeenCalledWith(
               'order-1', 'paid', '2024-01-01T10:00:00Z'
            );
         });

         it('should handle all payment events', async () => {
            const paymentEvents = ['pending', 'paid', 'refunded', 'failed'];

            for (const event of paymentEvents) {
               const paymentData = {
                  event,
                  timestamp: '2024-01-01T10:00:00Z'
               };

               mockOrderService.updatePaymentStatus.mockResolvedValue({ ...mockOrder, paymentStatus: event });

               const app = createApp();
               const response = await app.handle(
                  new Request('http://localhost/api/orders/order-1/payment-status', {
                     method: 'PUT',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(paymentData)
                  })
               );

               expect(response.status).toBe(200);
            }
         });

         it('should handle validation error for invalid event', async () => {
            const invalidData = {
               event: 'invalid_event',
               timestamp: '2024-01-01T10:00:00Z'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/payment-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422);
         });

         it('should handle validation error for invalid timestamp', async () => {
            const invalidData = {
               event: 'paid',
               timestamp: 'invalid_timestamp'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/payment-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422);
         });

         it('should handle service error', async () => {
            mockOrderService.updatePaymentStatus.mockRejectedValue(new Error('Order not found'));

            const paymentData = {
               event: 'paid',
               timestamp: '2024-01-01T10:00:00Z'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/payment-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(paymentData)
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Order not found');
         });
      });

      describe('PUT /:orderId/refund-status', () => {
         it('should update refund status successfully with amount', async () => {
            const refundData = {
               event: 'refunded',
               amount: 25000,
               timestamp: '2024-01-01T10:00:00Z'
            };

            const updatedOrder = { ...mockOrder, paymentStatus: 'refunded' };
            mockOrderService.updateRefundStatus.mockResolvedValue(updatedOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/refund-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(refundData)
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Refund status updated successfully');
            expect(mockOrderService.updateRefundStatus).toHaveBeenCalledWith(
               'order-1', 'refunded', 25000, '2024-01-01T10:00:00Z'
            );
         });

         it('should update refund status successfully without amount', async () => {
            const refundData = {
               event: 'refunded',
               timestamp: '2024-01-01T10:00:00Z'
            };

            mockOrderService.updateRefundStatus.mockResolvedValue(mockOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/refund-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(refundData)
               })
            );

            expect(response.status).toBe(200);
            expect(mockOrderService.updateRefundStatus).toHaveBeenCalledWith(
               'order-1', 'refunded', undefined, '2024-01-01T10:00:00Z'
            );
         });

         it('should handle validation error for negative amount', async () => {
            const invalidData = {
               event: 'refunded',
               amount: -1000,
               timestamp: '2024-01-01T10:00:00Z'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/refund-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422);
         });

         it('should handle service error', async () => {
            mockOrderService.updateRefundStatus.mockRejectedValue(new Error('Order not found'));

            const refundData = {
               event: 'refunded',
               timestamp: '2024-01-01T10:00:00Z'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/refund-status', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(refundData)
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Order not found');
         });
      });

      describe('PATCH /:orderId/cancel', () => {
         it('should cancel order successfully with reason', async () => {
            const cancelData = {
               reason: 'Customer request'
            };

            const cancelledOrder = { ...mockOrder, status: 'cancelled' };
            mockOrderService.cancelOrder.mockResolvedValue(cancelledOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/cancel', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cancelData)
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Order cancelled successfully');
            expect(mockOrderService.cancelOrder).toHaveBeenCalledWith('order-1', 'Customer request');
         });

         it('should cancel order successfully without reason', async () => {
            const cancelData = {};

            const cancelledOrder = { ...mockOrder, status: 'cancelled' };
            mockOrderService.cancelOrder.mockResolvedValue(cancelledOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/cancel', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cancelData)
               })
            );

            expect(response.status).toBe(200);
            expect(mockOrderService.cancelOrder).toHaveBeenCalledWith('order-1', undefined);
         });

         it('should handle service error', async () => {
            mockOrderService.cancelOrder.mockRejectedValue(new Error('Cannot cancel delivered order'));

            const cancelData = { reason: 'Customer request' };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/cancel', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(cancelData)
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Cannot cancel delivered order');
         });
      });

      describe('GET /stats/:restaurantId', () => {
         it('should get order statistics successfully', async () => {
            const mockStats = {
               total: 25,
               pending: 5,
               confirmed: 3,
               preparing: 2,
               ready: 4,
               picked_up: 1,
               delivered: 8,
               cancelled: 2
            };

            mockOrderService.getOrderStats.mockResolvedValue(mockStats);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/stats/restaurant-1')
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.stats).toEqual(mockStats);
            expect(mockOrderService.getOrderStats).toHaveBeenCalledWith('restaurant-1');
         });

         it('should handle service error', async () => {
            mockOrderService.getOrderStats.mockRejectedValue(new Error('Restaurant not found'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/stats/restaurant-1')
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Restaurant not found');
         });
      });
   });

   describe('Protected Routes', () => {
      describe('POST /', () => {
         it('should create order successfully', async () => {
            const orderData = {
               restaurantId: '550e8400-e29b-41d4-a716-446655440000',
               items: [
                  {
                     menuItemId: '550e8400-e29b-41d4-a716-446655440001',
                     quantity: 2
                  }
               ],
               deliveryAddress: '123 Main St'
            };

            const createdOrder = { ...mockOrder, customerId: 'user-1' };
            mockOrderService.createOrder.mockResolvedValue(createdOrder);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(orderData)
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Order created successfully');
            expect(data.data.order).toEqual(createdOrder);
         });

         it('should handle validation error', async () => {
            const invalidData = {};

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(invalidData)
               })
            );

            expect(response.status).toBe(422);
         });

         it('should handle service error when creating order', async () => {
            mockOrderService.createOrder.mockRejectedValue(new Error('Restaurant not found'));

            const orderData = {
               restaurantId: '550e8400-e29b-41d4-a716-446655440000',
               items: [
                  {
                     menuItemId: '550e8400-e29b-41d4-a716-446655440001',
                     quantity: 2
                  }
               ],
               deliveryAddress: '123 Main St'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(orderData)
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Restaurant not found');
         });

         it('should return 401 when missing authentication headers', async () => {
            const orderData = {
               restaurantId: '550e8400-e29b-41d4-a716-446655440000',
               items: [
                  {
                     menuItemId: '550e8400-e29b-41d4-a716-446655440001',
                     quantity: 2
                  }
               ],
               deliveryAddress: '123 Main St'
            };

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(orderData)
               })
            );

            expect(response.status).toBe(401);
         });
      });

      describe('POST /:orderId/accept', () => {
         it('should accept order successfully as driver', async () => {
            const acceptResult = {
               order: { ...mockOrder, status: 'confirmed', driverId: 'driver-1' },
               customerEmail: 'customer@example.com',
               customerName: 'John Doe',
               restaurantEmail: 'restaurant@example.com',
               restaurantName: 'Test Restaurant',
               driverName: 'Driver Smith',
               estimatedArrival: '10:30 AM'
            };

            mockOrderService.assignDriverWithDetails.mockResolvedValue(acceptResult);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/accept', {
                  method: 'POST',
                  headers: {
                     'x-user-id': 'driver-1',
                     'x-user-role': 'driver',
                     'x-user-email': 'driver@example.com'
                  }
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.message).toBe('Order accepted successfully');
            expect(data.data.order).toEqual(acceptResult.order);
            expect(data.data.customerEmail).toBe('customer@example.com');
            expect(data.data.driverName).toBe('Driver Smith');
            expect(mockOrderService.assignDriverWithDetails).toHaveBeenCalledWith('order-1', 'driver-1');
         });

         it('should handle error when order already assigned', async () => {
            mockOrderService.assignDriverWithDetails.mockRejectedValue(new Error('Order already assigned'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/accept', {
                  method: 'POST',
                  headers: {
                     'x-user-id': 'driver-1',
                     'x-user-role': 'driver',
                     'x-user-email': 'driver@example.com'
                  }
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Order already assigned');
         });

         it('should handle error when order not found', async () => {
            mockOrderService.assignDriverWithDetails.mockRejectedValue(new Error('Order not found'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/nonexistent/accept', {
                  method: 'POST',
                  headers: {
                     'x-user-id': 'driver-1',
                     'x-user-role': 'driver',
                     'x-user-email': 'driver@example.com'
                  }
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Order not found');
         });

         it('should return 401 when missing authentication headers', async () => {
            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/order-1/accept', {
                  method: 'POST'
               })
            );

            expect(response.status).toBe(401);
         });
      });

      describe('GET /my-orders', () => {
         it('should get customer orders successfully', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByCustomer.mockResolvedValue(mockOrders);
            mockOrderService.getCustomerOrdersCount.mockResolvedValue(1);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/my-orders', {
                  headers: {
                     'x-user-id': 'customer-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  }
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.orders).toEqual(mockOrders);
            expect(data.data.pagination.total).toBe(1);
            expect(data.data.pagination.totalPages).toBe(1);
            expect(mockOrderService.getOrdersByCustomer).toHaveBeenCalledWith('customer-1', 1, 10);
         });

         it('should handle pagination parameters correctly', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByCustomer.mockResolvedValue(mockOrders);
            mockOrderService.getCustomerOrdersCount.mockResolvedValue(25);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/my-orders?page=3&limit=5', {
                  headers: {
                     'x-user-id': 'customer-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  }
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.data.pagination.page).toBe(3);
            expect(data.data.pagination.limit).toBe(5);
            expect(data.data.pagination.totalPages).toBe(5);
            expect(mockOrderService.getOrdersByCustomer).toHaveBeenCalledWith('customer-1', 3, 5);
         });

         it('should use default pagination values for invalid parameters', async () => {
            const mockOrders = [mockOrder];
            mockOrderService.getOrdersByCustomer.mockResolvedValue(mockOrders);
            mockOrderService.getCustomerOrdersCount.mockResolvedValue(1);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/my-orders?page=invalid&limit=invalid', {
                  headers: {
                     'x-user-id': 'customer-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  }
               })
            );

            expect(mockOrderService.getOrdersByCustomer).toHaveBeenCalledWith('customer-1', 1, 10);
         });

         it('should handle empty orders list', async () => {
            mockOrderService.getOrdersByCustomer.mockResolvedValue([]);
            mockOrderService.getCustomerOrdersCount.mockResolvedValue(0);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/my-orders', {
                  headers: {
                     'x-user-id': 'customer-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  }
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.data.orders).toEqual([]);
            expect(data.data.pagination.total).toBe(0);
            expect(data.data.pagination.totalPages).toBe(0);
         });

         it('should return 401 when missing authentication headers', async () => {
            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/my-orders')
            );

            expect(response.status).toBe(401);
         });

         it('should handle service error', async () => {
            mockOrderService.getOrdersByCustomer.mockRejectedValue(new Error('Database error'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/my-orders', {
                  headers: {
                     'x-user-id': 'customer-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  }
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Database error');
         });
      });

      describe('GET /driver/available', () => {
         it('should get available orders successfully', async () => {
            const mockAvailableOrders = [
               { ...mockOrder, status: 'ready' },
               { ...mockOrder, id: 'order-2', status: 'preparing' }
            ];

            mockOrderService.getAvailableOrders.mockResolvedValue(mockAvailableOrders);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/driver/available', {
                  headers: {
                     'x-user-id': 'driver-1',
                     'x-user-role': 'driver',
                     'x-user-email': 'driver@example.com'
                  }
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.orders).toEqual(mockAvailableOrders);
            expect(mockOrderService.getAvailableOrders).toHaveBeenCalled();
         });

         it('should handle empty available orders', async () => {
            mockOrderService.getAvailableOrders.mockResolvedValue([]);

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/driver/available', {
                  headers: {
                     'x-user-id': 'driver-1',
                     'x-user-role': 'driver',
                     'x-user-email': 'driver@example.com'
                  }
               })
            );

            expect(response.status).toBe(200);

            const data = await response.json();
            expect(data.success).toBe(true);
            expect(data.data.orders).toEqual([]);
         });

         it('should handle service error', async () => {
            mockOrderService.getAvailableOrders.mockRejectedValue(new Error('Database error'));

            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/driver/available', {
                  headers: {
                     'x-user-id': 'driver-1',
                     'x-user-role': 'driver',
                     'x-user-email': 'driver@example.com'
                  }
               })
            );

            expect(response.status).toBe(400);

            const data = await response.json();
            expect(data.success).toBe(false);
            expect(data.message).toBe('Database error');
         });

         it('should return 401 when missing authentication headers', async () => {
            const app = createApp();
            const response = await app.handle(
               new Request('http://localhost/api/orders/driver/available')
            );

            expect(response.status).toBe(401);
         });
      });
   });

   // Edge cases and integration tests
   describe('Edge Cases', () => {
      it('should handle malformed JSON in request body', async () => {
         const app = createApp();
         const response = await app.handle(
            new Request('http://localhost/api/orders', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': 'user-1',
                  'x-user-role': 'customer',
                  'x-user-email': 'customer@example.com'
               },
               body: '{"invalid": json}'
            })
         );

         expect([400, 422]).toContain(response.status);
      });

      it('should handle missing content-type header', async () => {
         const orderData = {
            restaurantId: '550e8400-e29b-41d4-a716-446655440000',
            items: [
               {
                  menuItemId: '550e8400-e29b-41d4-a716-446655440001',
                  quantity: 2
               }
            ],
            deliveryAddress: '123 Main St'
         };

         const app = createApp();
         const response = await app.handle(
            new Request('http://localhost/api/orders', {
               method: 'POST',
               headers: {
                  'x-user-id': 'user-1',
                  'x-user-role': 'customer',
                  'x-user-email': 'customer@example.com'
               },
               body: JSON.stringify(orderData)
            })
         );

         expect([400, 422]).toContain(response.status);
      });

      it('should handle extremely large order quantities', async () => {
         const orderData = {
            restaurantId: '550e8400-e29b-41d4-a716-446655440000',
            items: [
               {
                  menuItemId: '550e8400-e29b-41d4-a716-446655440001',
                  quantity: 9999999
               }
            ],
            deliveryAddress: '123 Main St'
         };

         mockOrderService.createOrder.mockResolvedValue(mockOrder);

         const app = createApp();
         const response = await app.handle(
            new Request('http://localhost/api/orders', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json',
                  'x-user-id': 'user-1',
                  'x-user-role': 'customer',
                  'x-user-email': 'customer@example.com'
               },
               body: JSON.stringify(orderData)
            })
         );

         // Should either succeed or fail validation
         expect([200, 400, 422]).toContain(response.status);
      });

      it('should handle concurrent order creation attempts', async () => {
         const orderData = {
            restaurantId: '550e8400-e29b-41d4-a716-446655440000',
            items: [
               {
                  menuItemId: '550e8400-e29b-41d4-a716-446655440001',
                  quantity: 1
               }
            ],
            deliveryAddress: '123 Main St'
         };

         mockOrderService.createOrder.mockResolvedValue(mockOrder);

         const app = createApp();

         // Simulate concurrent requests
         const promises = Array(5).fill(null).map(() =>
            app.handle(
               new Request('http://localhost/api/orders', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json',
                     'x-user-id': 'user-1',
                     'x-user-role': 'customer',
                     'x-user-email': 'customer@example.com'
                  },
                  body: JSON.stringify(orderData)
               })
            )
         );

         const responses = await Promise.all(promises);

         // All should succeed or handle gracefully
         responses.forEach(response => {
            expect([200, 400, 429]).toContain(response.status);
         });
      });
   });
});