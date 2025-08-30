CREATE TYPE "public"."payment" AS ENUM('pending', 'paid', 'refunded', 'failed');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'refunded';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_status" "payment" DEFAULT 'pending';