ALTER TABLE "review_helpful" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "review_responses" DROP COLUMN "updated_at";