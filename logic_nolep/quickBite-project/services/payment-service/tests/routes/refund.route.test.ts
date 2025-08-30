import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Elysia, t } from 'elysia';

// Mock utils first
mock.module('../../src/utils/response', () => ({
   successResponse: (data: any, message?: string) => ({
      success: true,
      data,
      message,
      timestamp: new Date().toISOString(),
   }),
   errorResponse: (error: string, data?: any) => ({
      success: false,
      error,
      data,
      timestamp: new Date().toISOString(),
   })
}));

// Mock types with proper TypeBox schemas
mock.module('../../src/types', () => ({
   createRefundSchema: t.Object({
      orderId: t.String({ format: 'uuid' }),
      amount: t.Optional(t.Number({ minimum: 0 })),
      reason: t.Union([
         t.Literal('customer_request'),
         t.Literal('restaurant_cancelled'),
         t.Literal('driver_unavailable'),
         t.Literal('food_quality'),
         t.Literal('other')
      ]),
      description: t.Optional(t.String()),
      requestedBy: t.String({ format: 'uuid' })
   }),
   refundStatsQuerySchema: t.Object({
      restaurantId: t.Optional(t.String({ format: 'uuid' })),
      dateFrom: t.Optional(t.String({ format: 'date' })),
      dateTo: t.Optional(t.String({ format: 'date' }))
   })
}));

// Import route factory after mock setup
import { createRefundsRoute } from '../../src/routes/refund.route';

describe('Refund Routes with DI', () => {
   let app: Elysia;
   let mockRefundService: any;

   beforeEach(() => {
      // Create mock service with all required methods
      mockRefundService = {
         createRefund: mock(),
         getRefundsByOrderId: mock(),
         processAutomaticRefund: mock(),
         getRefundStats: mock(),
         updateRefundStatus: mock()
      };

      // Reset all mocks
      Object.values(mockRefundService).forEach((mockFn: any) => mockFn.mockReset());

      // Create app with mock service
      app = new Elysia().use(createRefundsRoute(mockRefundService));
   });

   describe('POST /api/refunds/create', () => {
      test('should successfully create refund', async () => {
         const mockRefund = {
            id: 'refund-123',
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 50.00,
            status: 'processing',
            refundId: 're_test_123'
         };

         mockRefundService.createRefund.mockResolvedValue(mockRefund);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  amount: 50.00,
                  reason: 'customer_request',
                  description: 'Customer requested refund',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockRefund);
         expect(data.message).toBe('Refund initiated successfully');
         expect(mockRefundService.createRefund).toHaveBeenCalledWith({
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 50.00,
            reason: 'customer_request',
            description: 'Customer requested refund',
            requestedBy: '550e8400-e29b-41d4-a716-446655440001'
         });
      });

      test('should create refund without amount (full refund)', async () => {
         const mockRefund = {
            id: 'refund-123',
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 100.00,
            status: 'processing',
            refundId: 're_test_123'
         };

         mockRefundService.createRefund.mockResolvedValue(mockRefund);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'restaurant_cancelled',
                  description: 'Restaurant cancelled the order',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockRefund);
      });

      test('should handle refund creation error', async () => {
         mockRefundService.createRefund.mockRejectedValue(new Error('Payment not found for this order'));

         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Payment not found for this order');
      });

      test('should validate required fields', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  // Missing required fields
                  reason: 'customer_request'
               })
            })
         );

         expect(response.status).toBe(422);
      });

      test('should validate UUID format for orderId', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: 'invalid-uuid',
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(422);
      });

      test('should validate refund reason enum', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'invalid_reason',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(422);
      });

      test('should validate minimum amount', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  amount: -10, // Invalid negative amount
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(422);
      });
   });

   describe('GET /api/refunds/order/:orderId', () => {
      test('should successfully get refunds by order ID', async () => {
         const mockRefunds = [
            {
               id: 'refund-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: '50.00',
               status: 'succeeded',
               reason: 'customer_request'
            },
            {
               id: 'refund-124',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: '25.00',
               status: 'processing',
               reason: 'food_quality'
            }
         ];

         mockRefundService.getRefundsByOrderId.mockResolvedValue(mockRefunds);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/order/550e8400-e29b-41d4-a716-446655440000')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockRefunds);
         expect(mockRefundService.getRefundsByOrderId).toHaveBeenCalledWith(
            '550e8400-e29b-41d4-a716-446655440000'
         );
      });

      test('should return empty array when no refunds found', async () => {
         mockRefundService.getRefundsByOrderId.mockResolvedValue([]);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/order/550e8400-e29b-41d4-a716-446655440000')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual([]);
      });

      test('should handle service error', async () => {
         mockRefundService.getRefundsByOrderId.mockRejectedValue(new Error('Database connection failed'));

         const response = await app.handle(
            new Request('http://localhost/api/refunds/order/550e8400-e29b-41d4-a716-446655440000')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Database connection failed');
      });

      test('should validate UUID format for orderId parameter', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/order/invalid-uuid-format')
         );

         expect(response.status).toBe(422);
      });
   });

   describe('POST /api/refunds/auto-refund', () => {
      test('should successfully process automatic refund', async () => {
         const mockAutoRefund = {
            refund: {
               id: 'refund-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: 100.00,
               status: 'processing'
            },
            customerEmail: 'customer@example.com',
            refundAmount: 100.00
         };

         mockRefundService.processAutomaticRefund.mockResolvedValue(mockAutoRefund);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/auto-refund', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'restaurant_cancelled'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockAutoRefund);
         expect(data.message).toBe('Automatic refund processed successfully');
         expect(mockRefundService.processAutomaticRefund).toHaveBeenCalledWith(
            '550e8400-e29b-41d4-a716-446655440000',
            'restaurant_cancelled'
         );
      });

      test('should handle case when no refund is needed', async () => {
         mockRefundService.processAutomaticRefund.mockResolvedValue(null);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/auto-refund', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'driver_unavailable'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toBe(null);
         expect(data.message).toBe('No refund needed for this order');
      });

      test('should use default reason when not provided', async () => {
         const mockAutoRefund = {
            refund: {
               id: 'refund-123',
               orderId: '550e8400-e29b-41d4-a716-446655440000',
               amount: 100.00,
               status: 'processing'
            },
            customerEmail: 'customer@example.com',
            refundAmount: 100.00
         };

         mockRefundService.processAutomaticRefund.mockResolvedValue(mockAutoRefund);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/auto-refund', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000'
               })
            })
         );

         expect(response.status).toBe(200);
         expect(mockRefundService.processAutomaticRefund).toHaveBeenCalledWith(
            '550e8400-e29b-41d4-a716-446655440000',
            'other'
         );
      });

      test('should handle automatic refund processing error', async () => {
         mockRefundService.processAutomaticRefund.mockRejectedValue(new Error('Payment not found'));

         const response = await app.handle(
            new Request('http://localhost/api/refunds/auto-refund', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'customer_request'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Payment not found');
      });

      test('should validate orderId format', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/auto-refund', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: 'invalid-uuid',
                  reason: 'restaurant_cancelled'
               })
            })
         );

         expect(response.status).toBe(422);
      });

      test('should validate reason enum when provided', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/auto-refund', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'invalid_reason'
               })
            })
         );

         expect(response.status).toBe(422);
      });
   });

   describe('GET /api/refunds/stats', () => {
      test('should successfully get refund statistics without filters', async () => {
         const mockStats = {
            totalRefunds: 150,
            successfulRefunds: 135,
            totalRefundAmount: 5250.00,
            refundRate: 90.0
         };

         mockRefundService.getRefundStats.mockResolvedValue(mockStats);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockStats);
         expect(mockRefundService.getRefundStats).toHaveBeenCalledWith(
            undefined,
            undefined,
            undefined
         );
      });

      test('should get refund statistics with restaurant filter', async () => {
         const mockStats = {
            totalRefunds: 25,
            successfulRefunds: 23,
            totalRefundAmount: 875.00,
            refundRate: 92.0
         };

         mockRefundService.getRefundStats.mockResolvedValue(mockStats);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats?restaurantId=550e8400-e29b-41d4-a716-446655440000')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockStats);
         expect(mockRefundService.getRefundStats).toHaveBeenCalledWith(
            '550e8400-e29b-41d4-a716-446655440000',
            undefined,
            undefined
         );
      });

      test('should get refund statistics with date range filters', async () => {
         const mockStats = {
            totalRefunds: 45,
            successfulRefunds: 42,
            totalRefundAmount: 1680.00,
            refundRate: 93.3
         };

         mockRefundService.getRefundStats.mockResolvedValue(mockStats);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats?dateFrom=2024-01-01&dateTo=2024-01-31')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockStats);
         expect(mockRefundService.getRefundStats).toHaveBeenCalledWith(
            undefined,
            new Date('2024-01-01'),
            new Date('2024-01-31')
         );
      });

      test('should get refund statistics with all filters', async () => {
         const mockStats = {
            totalRefunds: 8,
            successfulRefunds: 7,
            totalRefundAmount: 280.00,
            refundRate: 87.5
         };

         mockRefundService.getRefundStats.mockResolvedValue(mockStats);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats?restaurantId=550e8400-e29b-41d4-a716-446655440000&dateFrom=2024-01-01&dateTo=2024-01-31')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(true);
         expect(data.data).toEqual(mockStats);
         expect(mockRefundService.getRefundStats).toHaveBeenCalledWith(
            '550e8400-e29b-41d4-a716-446655440000',
            new Date('2024-01-01'),
            new Date('2024-01-31')
         );
      });

      test('should handle statistics retrieval error', async () => {
         mockRefundService.getRefundStats.mockRejectedValue(new Error('Database query failed'));

         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats')
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Database query failed');
      });

      test('should validate UUID format for restaurantId query parameter', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats?restaurantId=invalid-uuid')
         );

         expect(response.status).toBe(422);
      });

      test('should validate date format for date query parameters', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/stats?dateFrom=invalid-date')
         );

         expect(response.status).toBe(422);
      });
   });

   describe('Edge Cases and Error Handling', () => {
      test('should handle malformed JSON in request body', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: 'invalid json {'
            })
         );

         expect(response.status).toBe(400);
      });

      test('should handle service timeout errors', async () => {
         mockRefundService.createRefund.mockRejectedValue(new Error('Request timeout'));

         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(200);
         const data = await response.json();
         expect(data.success).toBe(false);
         expect(data.error).toBe('Request timeout');
      });

      test('should handle missing Content-Type header', async () => {
         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(response.status).toBe(422);
      });
   });

   describe('Response Format Consistency', () => {
      test('should return consistent response format for successful operations', async () => {
         const mockRefund = {
            id: 'refund-123',
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 50.00,
            status: 'processing'
         };

         mockRefundService.createRefund.mockResolvedValue(mockRefund);

         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         const data = await response.json();
         expect(data).toHaveProperty('success');
         expect(data).toHaveProperty('data');
         expect(data).toHaveProperty('message');
         expect(data).toHaveProperty('timestamp');
         expect(typeof data.timestamp).toBe('string');
      });

      test('should return consistent error response format', async () => {
         mockRefundService.createRefund.mockRejectedValue(new Error('Test error'));

         const response = await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  reason: 'customer_request',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         const data = await response.json();
         expect(data).toHaveProperty('success');
         expect(data).toHaveProperty('error');
         expect(data).toHaveProperty('timestamp');
         expect(data.success).toBe(false);
         expect(typeof data.timestamp).toBe('string');
      });
   });

   describe('Business Logic Validation', () => {
      test('should pass correct parameters to service methods', async () => {
         const mockRefund = {
            id: 'refund-123',
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 75.50,
            status: 'processing'
         };

         mockRefundService.createRefund.mockResolvedValue(mockRefund);

         await app.handle(
            new Request('http://localhost/api/refunds/create', {
               method: 'POST',
               headers: {
                  'Content-Type': 'application/json'
               },
               body: JSON.stringify({
                  orderId: '550e8400-e29b-41d4-a716-446655440000',
                  amount: 75.50,
                  reason: 'food_quality',
                  description: 'Food was cold and inedible',
                  requestedBy: '550e8400-e29b-41d4-a716-446655440001'
               })
            })
         );

         expect(mockRefundService.createRefund).toHaveBeenCalledWith({
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 75.50,
            reason: 'food_quality',
            description: 'Food was cold and inedible',
            requestedBy: '550e8400-e29b-41d4-a716-446655440001'
         });
      });

      test('should handle all valid refund reasons', async () => {
         const validReasons = [
            'customer_request',
            'restaurant_cancelled',
            'driver_unavailable',
            'food_quality',
            'other'
         ];

         const mockRefund = {
            id: 'refund-123',
            orderId: '550e8400-e29b-41d4-a716-446655440000',
            amount: 50.00,
            status: 'processing'
         };

         mockRefundService.createRefund.mockResolvedValue(mockRefund);

         for (const reason of validReasons) {
            const response = await app.handle(
               new Request('http://localhost/api/refunds/create', {
                  method: 'POST',
                  headers: {
                     'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                     orderId: '550e8400-e29b-41d4-a716-446655440000',
                     reason: reason,
                     requestedBy: '550e8400-e29b-41d4-a716-446655440001'
                  })
               })
            );

            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.success).toBe(true);
         }
      });
   });
});