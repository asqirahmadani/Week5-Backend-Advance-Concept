ALTER TABLE "users" ADD COLUMN "stripe_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_onboarding_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_created_at" timestamp;