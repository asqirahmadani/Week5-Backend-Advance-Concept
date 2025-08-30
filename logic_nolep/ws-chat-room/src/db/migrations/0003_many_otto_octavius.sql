ALTER TABLE "messages" ADD COLUMN "is_edited" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "is_deleted" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_at" timestamp;