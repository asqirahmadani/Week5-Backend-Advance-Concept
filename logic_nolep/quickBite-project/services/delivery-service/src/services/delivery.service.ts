import { eq, and, sql } from "drizzle-orm";
import { db, type Database } from "../db/client";
import { deliveryAssignment, driverLocations, deliveryTracking } from "../db/schema";
import type { NewDeliveryAssignment, NewDriverLocation, NewDeliveryTracking } from "../db/schema";

export class DeliveryService {
   private db: Database;

   constructor(injectedDatabase?: Database) {
      this.db = injectedDatabase || db;
   }

   // assing driver to order
   async assignDriver(data: {
      orderId: string;
      customerId: string;
      restaurantId: string;
      deliveryAddress: string;
      customerPhone?: string;
      restaurantAddress?: string;
   }, driverId?: string) {
      const availableDriver = await this.db.select()
         .from(driverLocations)
         .where(eq(driverLocations.isOnline, true))
         .limit(1);

      if (availableDriver.length === 0) {
         throw new Error('No available drivers found');
      }

      const assignment: NewDeliveryAssignment = {
         orderId: data.orderId,
         driverId: availableDriver[0].driverId,
         deliveryAddress: data.deliveryAddress,
         customerPhone: data.customerPhone,
         restaurantAddress: data.restaurantAddress,
         estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000)   // 45 minutes
      }

      const [newAssignment] = await this.db
         .insert(deliveryAssignment)
         .values(assignment)
         .returning();

      if (driverId) await this.acceptDelivery(newAssignment.id, driverId);

      return newAssignment;
   }

   // driver accpets delivery assignment
   async acceptDelivery(deliveryId: string, driverId: string) {
      const [updated] = await this.db.update(deliveryAssignment)
         .set({
            status: 'accepted',
            acceptedAt: new Date(),
            updatedAt: new Date()
         })
         .where(and(
            eq(deliveryAssignment.id, deliveryId),
            eq(deliveryAssignment.driverId, driverId)
         ))
         .returning();

      if (!updated) {
         throw new Error('Delivery assignment not found or unauthorized');
      }

      return updated;
   }

   // update delivery status
   async updateDeliveryStatus(
      deliveryId: string,
      driverId: string,
      status: 'picked_up' | 'delivered' | 'cancelled',
      location?: { latitude: number; longitude: number }
   ) {
      const updateData: any = {
         status,
         updatedAt: new Date()
      }

      if (status === 'picked_up') {
         updateData.pickedUpAt = new Date();
      } else if (status === 'delivered') {
         updateData.deliveredAt = new Date();
         updateData.actualDeliveryTime = new Date();
      }

      const [updated] = await this.db.update(deliveryAssignment)
         .set(updateData)
         .where(
            and(
               eq(deliveryAssignment.id, deliveryId),
               eq(deliveryAssignment.driverId, driverId)
            )
         )
         .returning();
      console.log(updated);
      if (!updated) {
         throw new Error('Delivery assignment not found or unauthorized');
      }

      if (location) {
         await this.addTrackingPoint(deliveryId, location.latitude, location.longitude, status);
      }

      return updated;
   }

   async cancelDelivery(deliveryId: string) {
      const [cancelled] = await this.db.update(deliveryAssignment)
         .set({ status: 'cancelled' })
         .where(eq(deliveryAssignment.id, deliveryId))
         .returning();

      if (!cancelled) {
         throw new Error('Delivery assignment not found or unauthorized');
      }

      return cancelled;
   }

   // update driver location
   async updateDriverLocation(driverId: string, latitude: number, longitude: number, isOnline: boolean = true) {
      const locationData: NewDriverLocation = {
         driverId,
         latitude: latitude.toString(),
         longitude: longitude.toString(),
         isOnline,
         lastUpdated: new Date()
      };

      const [updated] = await this.db.insert(driverLocations)
         .values(locationData)
         .onConflictDoUpdate({
            target: driverLocations.driverId,
            set: {
               latitude: locationData.latitude,
               longitude: locationData.longitude,
               isOnline: locationData.isOnline,
               lastUpdated: locationData.lastUpdated
            }
         })
         .returning();

      return updated;
   }

   // add tracking point
   async addTrackingPoint(deliveryId: string, latitude: number, longitude: number, status?: string) {
      const trackingData: NewDeliveryTracking = {
         deliveryId,
         latitude: latitude.toString(),
         longitude: longitude.toString(),
         status
      };

      const [tracking] = await this.db.insert(deliveryTracking)
         .values(trackingData)
         .returning();

      return tracking;
   }

   // get delivery by order id
   async getDeliveryByOrderId(orderId: string) {
      const delivery = await this.db.select()
         .from(deliveryAssignment)
         .where(eq(deliveryAssignment.orderId, orderId))

      return delivery[0] || null;
   }

   // get driver's active deliveries
   async getDriverDeliveries(driverId: string) {
      const deliveries = await this.db.select()
         .from(deliveryAssignment)
         .where(and(
            eq(deliveryAssignment.driverId, driverId),
            sql`${deliveryAssignment.status} IN ('assigned', 'accepted', 'picked_up')`
         ));

      return deliveries;
   }

   // get delivery tracking history
   async getDeliveryTracking(deliveryId: string) {
      const tracking = await this.db.select()
         .from(deliveryTracking)
         .where(eq(deliveryTracking.deliveryId, deliveryId))
         .orderBy(deliveryTracking.timestamp);

      return tracking;
   }

   async getOnlineDriversCount() {
      const result = await this.db
         .select({ count: sql<number>`count(*)` })
         .from(driverLocations)
         .where(eq(driverLocations.isOnline, true));

      return result[0]?.count || 0;
   }
}