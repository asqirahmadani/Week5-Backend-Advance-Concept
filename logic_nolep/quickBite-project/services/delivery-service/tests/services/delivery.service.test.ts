import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { DeliveryService } from '../../src/services/delivery.service';
import type { Database } from '../../src/db/client';

// Helper functions to create mock data
const createMockDeliveryAssignment = (overrides: any = {}) => ({
   id: 'delivery_123',
   orderId: 'order_123',
   driverId: 'driver_123',
   status: 'assigned' as const,
   assignedAt: new Date(),
   acceptedAt: null,
   pickedUpAt: null,
   deliveredAt: null,
   estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000),
   actualDeliveryTime: null,
   deliveryAddress: '123 Customer St',
   customerPhone: '+1234567890',
   restaurantAddress: '456 Restaurant Ave',
   notes: null,
   createdAt: new Date(),
   updatedAt: new Date(),
   ...overrides,
});

const createMockDriverLocation = (overrides: any = {}) => ({
   driverId: 'driver_123',
   latitude: '40.7128',
   longitude: '-74.0060',
   timestamp: new Date(),
   isOnline: true,
   lastUpdated: new Date(),
   ...overrides,
});

const createMockDeliveryTracking = (overrides: any = {}) => ({
   id: 'tracking_123',
   deliveryId: 'delivery_123',
   latitude: '40.7128',
   longitude: '-74.0060',
   timestamp: new Date(),
   status: 'picked_up',
   notes: null,
   ...overrides,
});

describe('DeliveryService', () => {
   let deliveryService: DeliveryService;
   let mockDb: Database;

   beforeEach(() => {
      // Create mock database with all required methods
      mockDb = {
         select: mock(),
         insert: mock(),
         update: mock(),
      } as any;

      deliveryService = new DeliveryService(mockDb);

      // Mock console to avoid noise in tests
      spyOn(console, 'log').mockImplementation(() => { });
      spyOn(console, 'error').mockImplementation(() => { });
   });

   describe('assignDriver', () => {
      it('should assign driver to order successfully', async () => {
         const orderData = {
            orderId: 'order_123',
            customerId: 'customer_123',
            restaurantId: 'restaurant_123',
            deliveryAddress: '123 Customer St',
            customerPhone: '+1234567890',
            restaurantAddress: '456 Restaurant Ave',
         };

         const mockDriver = createMockDriverLocation();
         const mockAssignment = createMockDeliveryAssignment();

         // Mock the database chain for finding available driver
         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.resolve([mockDriver]))
               }))
            }))
         };

         // Mock the database chain for inserting assignment
         const mockInsertChain = {
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockAssignment]))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);
         (mockDb.insert as any).mockImplementation(() => mockInsertChain);

         const result = await deliveryService.assignDriver(orderData);

         expect(result).toEqual(mockAssignment);
         expect(mockDb.select).toHaveBeenCalled();
         expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should throw error when no drivers are available', async () => {
         const orderData = {
            orderId: 'order_123',
            customerId: 'customer_123',
            restaurantId: 'restaurant_123',
            deliveryAddress: '123 Customer St',
         };

         // Mock empty driver result
         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.resolve([]))
               }))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         await expect(deliveryService.assignDriver(orderData)).rejects.toThrow('No available drivers found');
      });

      it('should auto-accept delivery when driverId is provided', async () => {
         const orderData = {
            orderId: 'order_123',
            customerId: 'customer_123',
            restaurantId: 'restaurant_123',
            deliveryAddress: '123 Customer St',
         };

         const mockDriver = createMockDriverLocation();
         const mockAssignment = createMockDeliveryAssignment();
         const acceptedAssignment = createMockDeliveryAssignment({
            status: 'accepted',
            acceptedAt: new Date()
         });

         // Mock select chain
         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.resolve([mockDriver]))
               }))
            }))
         };

         // Mock insert chain
         const mockInsertChain = {
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockAssignment]))
            }))
         };

         // Mock update chain for accept delivery
         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([acceptedAssignment]))
               }))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);
         (mockDb.insert as any).mockImplementation(() => mockInsertChain);
         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         const result = await deliveryService.assignDriver(orderData, 'driver_123');

         expect(result).toEqual(mockAssignment);
         expect(mockDb.update).toHaveBeenCalled();
      });
   });

   describe('acceptDelivery', () => {
      it('should accept delivery successfully', async () => {
         const deliveryId = 'delivery_123';
         const driverId = 'driver_123';
         const acceptedAssignment = createMockDeliveryAssignment({
            status: 'accepted',
            acceptedAt: new Date()
         });

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([acceptedAssignment]))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         const result = await deliveryService.acceptDelivery(deliveryId, driverId);

         expect(result).toEqual(acceptedAssignment);
         expect(mockDb.update).toHaveBeenCalled();
      });

      it('should throw error when delivery not found', async () => {
         const deliveryId = 'nonexistent_delivery';
         const driverId = 'driver_123';

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([]))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         await expect(deliveryService.acceptDelivery(deliveryId, driverId))
            .rejects.toThrow('Delivery assignment not found or unauthorized');
      });
   });

   describe('updateDeliveryStatus', () => {
      it('should update delivery status to picked_up', async () => {
         const deliveryId = 'delivery_123';
         const driverId = 'driver_123';
         const location = { latitude: 40.7128, longitude: -74.0060 };

         const updatedAssignment = createMockDeliveryAssignment({
            status: 'picked_up',
            pickedUpAt: new Date()
         });

         const mockTracking = createMockDeliveryTracking({ status: 'picked_up' });

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([updatedAssignment]))
               }))
            }))
         };

         const mockInsertChain = {
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockTracking]))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);
         (mockDb.insert as any).mockImplementation(() => mockInsertChain);

         const result = await deliveryService.updateDeliveryStatus(
            deliveryId,
            driverId,
            'picked_up',
            location
         );

         expect(result).toEqual(updatedAssignment);
         expect(mockDb.update).toHaveBeenCalled();
         expect(mockDb.insert).toHaveBeenCalled(); // For tracking
      });

      it('should update delivery status to delivered', async () => {
         const deliveryId = 'delivery_123';
         const driverId = 'driver_123';

         const deliveredAssignment = createMockDeliveryAssignment({
            status: 'delivered',
            deliveredAt: new Date(),
            actualDeliveryTime: new Date()
         });

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([deliveredAssignment]))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         const result = await deliveryService.updateDeliveryStatus(
            deliveryId,
            driverId,
            'delivered'
         );

         expect(result).toEqual(deliveredAssignment);
         expect(mockDb.update).toHaveBeenCalled();
      });

      it('should throw error when delivery not found', async () => {
         const deliveryId = 'nonexistent_delivery';
         const driverId = 'driver_123';

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([]))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         await expect(deliveryService.updateDeliveryStatus(deliveryId, driverId, 'picked_up'))
            .rejects.toThrow('Delivery assignment not found or unauthorized');
      });
   });

   describe('cancelDelivery', () => {
      it('should cancel delivery successfully', async () => {
         const deliveryId = 'delivery_123';
         const cancelledAssignment = createMockDeliveryAssignment({ status: 'cancelled' });

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([cancelledAssignment]))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         const result = await deliveryService.cancelDelivery(deliveryId);

         expect(result).toEqual(cancelledAssignment);
         expect(mockDb.update).toHaveBeenCalled();
      });

      it('should throw error when delivery not found', async () => {
         const deliveryId = 'nonexistent_delivery';

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.resolve([]))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         await expect(deliveryService.cancelDelivery(deliveryId))
            .rejects.toThrow('Delivery assignment not found or unauthorized');
      });
   });

   describe('updateDriverLocation', () => {
      it('should update driver location successfully', async () => {
         const driverId = 'driver_123';
         const latitude = 40.7128;
         const longitude = -74.0060;
         const updatedLocation = createMockDriverLocation({ latitude: '40.7128', longitude: '-74.0060' });

         const mockInsertChain = {
            values: mock(() => ({
               onConflictDoUpdate: mock(() => ({
                  returning: mock(() => Promise.resolve([updatedLocation]))
               }))
            }))
         };

         (mockDb.insert as any).mockImplementation(() => mockInsertChain);

         const result = await deliveryService.updateDriverLocation(driverId, latitude, longitude, true);

         expect(result).toEqual(updatedLocation);
         expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should update driver location with default online status', async () => {
         const driverId = 'driver_123';
         const latitude = 40.7128;
         const longitude = -74.0060;
         const updatedLocation = createMockDriverLocation();

         const mockInsertChain = {
            values: mock(() => ({
               onConflictDoUpdate: mock(() => ({
                  returning: mock(() => Promise.resolve([updatedLocation]))
               }))
            }))
         };

         (mockDb.insert as any).mockImplementation(() => mockInsertChain);

         const result = await deliveryService.updateDriverLocation(driverId, latitude, longitude);

         expect(result).toEqual(updatedLocation);
         expect(mockDb.insert).toHaveBeenCalled();
      });
   });

   describe('addTrackingPoint', () => {
      it('should add tracking point successfully', async () => {
         const deliveryId = 'delivery_123';
         const latitude = 40.7128;
         const longitude = -74.0060;
         const status = 'picked_up';
         const mockTracking = createMockDeliveryTracking({ status });

         const mockInsertChain = {
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockTracking]))
            }))
         };

         (mockDb.insert as any).mockImplementation(() => mockInsertChain);

         const result = await deliveryService.addTrackingPoint(deliveryId, latitude, longitude, status);

         expect(result).toEqual(mockTracking);
         expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should add tracking point without status', async () => {
         const deliveryId = 'delivery_123';
         const latitude = 40.7128;
         const longitude = -74.0060;
         const mockTracking = createMockDeliveryTracking({ status: undefined });

         const mockInsertChain = {
            values: mock(() => ({
               returning: mock(() => Promise.resolve([mockTracking]))
            }))
         };

         (mockDb.insert as any).mockImplementation(() => mockInsertChain);

         const result = await deliveryService.addTrackingPoint(deliveryId, latitude, longitude);

         expect(result).toEqual(mockTracking);
         expect(mockDb.insert).toHaveBeenCalled();
      });
   });

   describe('getDeliveryByOrderId', () => {
      it('should return delivery when found', async () => {
         const orderId = 'order_123';
         const mockDelivery = createMockDeliveryAssignment();

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve([mockDelivery]))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getDeliveryByOrderId(orderId);

         expect(result).toEqual(mockDelivery);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return null when delivery not found', async () => {
         const orderId = 'nonexistent_order';

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve([]))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getDeliveryByOrderId(orderId);

         expect(result).toBeNull();
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe('getDriverDeliveries', () => {
      it('should return active deliveries for driver', async () => {
         const driverId = 'driver_123';
         const mockDeliveries = [
            createMockDeliveryAssignment({ status: 'assigned' }),
            createMockDeliveryAssignment({ status: 'accepted' }),
            createMockDeliveryAssignment({ status: 'picked_up' }),
         ];

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve(mockDeliveries))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getDriverDeliveries(driverId);

         expect(result).toEqual(mockDeliveries);
         expect(result).toHaveLength(3);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return empty array when no active deliveries', async () => {
         const driverId = 'driver_123';

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve([]))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getDriverDeliveries(driverId);

         expect(result).toEqual([]);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe('getDeliveryTracking', () => {
      it('should return delivery tracking history', async () => {
         const deliveryId = 'delivery_123';
         const mockTrackingHistory = [
            createMockDeliveryTracking({ status: 'assigned' }),
            createMockDeliveryTracking({ status: 'accepted' }),
            createMockDeliveryTracking({ status: 'picked_up' }),
         ];

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  orderBy: mock(() => Promise.resolve(mockTrackingHistory))
               }))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getDeliveryTracking(deliveryId);

         expect(result).toEqual(mockTrackingHistory);
         expect(result).toHaveLength(3);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return empty array when no tracking found', async () => {
         const deliveryId = 'delivery_123';

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  orderBy: mock(() => Promise.resolve([]))
               }))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getDeliveryTracking(deliveryId);

         expect(result).toEqual([]);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe('getOnlineDriversCount', () => {
      it('should return count of online drivers', async () => {
         const mockCountResult = [{ count: 5 }];

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve(mockCountResult))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getOnlineDriversCount();

         expect(result).toBe(5);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return 0 when no online drivers', async () => {
         const mockCountResult = [{ count: 0 }];

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve(mockCountResult))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getOnlineDriversCount();

         expect(result).toBe(0);
         expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return 0 when result is undefined', async () => {
         const mockCountResult: any[] = [];

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => Promise.resolve(mockCountResult))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         const result = await deliveryService.getOnlineDriversCount();

         expect(result).toBe(0);
         expect(mockDb.select).toHaveBeenCalled();
      });
   });

   describe('Error handling', () => {
      it('should handle database errors in assignDriver', async () => {
         const orderData = {
            orderId: 'order_123',
            customerId: 'customer_123',
            restaurantId: 'restaurant_123',
            deliveryAddress: '123 Customer St',
         };

         const mockSelectChain = {
            from: mock(() => ({
               where: mock(() => ({
                  limit: mock(() => Promise.reject(new Error('Database error')))
               }))
            }))
         };

         (mockDb.select as any).mockImplementation(() => mockSelectChain);

         await expect(deliveryService.assignDriver(orderData))
            .rejects.toThrow('Database error');
      });

      it('should handle database errors in updateDeliveryStatus', async () => {
         const deliveryId = 'delivery_123';
         const driverId = 'driver_123';

         const mockUpdateChain = {
            set: mock(() => ({
               where: mock(() => ({
                  returning: mock(() => Promise.reject(new Error('Database error')))
               }))
            }))
         };

         (mockDb.update as any).mockImplementation(() => mockUpdateChain);

         await expect(deliveryService.updateDeliveryStatus(deliveryId, driverId, 'picked_up'))
            .rejects.toThrow('Database error');
      });
   });
});