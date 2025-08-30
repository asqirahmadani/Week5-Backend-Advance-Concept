CREATE TABLE "delivery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"driver_id" uuid NOT NULL,
	"status" text DEFAULT 'assigned',
	"assigned_at" timestamp DEFAULT now(),
	"accepeted_at" timestamp,
	"picked_up_at" timestamp,
	"delivered_at" timestamp,
	"estimated_delivery_time" timestamp,
	"actual_delivery_time" timestamp,
	"delivery_address" text NOT NULL,
	"customer_phone" text,
	"restaurant_address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "delivery_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"delivery_id" uuid NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"status" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "driver_locations" (
	"driver_id" uuid PRIMARY KEY NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"is_online" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_delivery_id_delivery_assignments_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE no action ON UPDATE no action;