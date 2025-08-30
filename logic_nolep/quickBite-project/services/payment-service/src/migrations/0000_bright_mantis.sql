CREATE TYPE "public"."payment_method" AS ENUM('card', 'wallet', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid');--> statement-breakpoint
CREATE TYPE "public"."refund_reason" AS ENUM('customer_request', 'restaurant_cancelled', 'driver_unavailable', 'food_quality', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'processing', 'paid');--> statement-breakpoint
CREATE TABLE "driver_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"base_earning" numeric(10, 2) NOT NULL,
	"tip_amount" numeric(10, 2) DEFAULT '0',
	"bonus_amount" numeric(10, 2) DEFAULT '0',
	"total_earning" numeric(10, 2) NOT NULL,
	"payout_status" "payout_status" DEFAULT 'pending',
	"payout_date" timestamp,
	"stripe_transfer_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"fees" numeric(10, 2) DEFAULT '0',
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"stripe_refund_id" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"reason" "refund_reason" NOT NULL,
	"description" text,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"requested_by" uuid NOT NULL,
	"processed_by" uuid,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "refunds_stripe_refund_id_unique" UNIQUE("stripe_refund_id")
);
--> statement-breakpoint
CREATE TABLE "restaurant_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"gross_amount" numeric(10, 2) NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"net_amount" numeric(10, 2) NOT NULL,
	"settlement_status" "settlement_status" DEFAULT 'pending',
	"settlement_date" timestamp,
	"stripe_transfer_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;