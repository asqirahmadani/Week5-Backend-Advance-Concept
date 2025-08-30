CREATE TABLE "notification_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_id" uuid NOT NULL,
	"status" text NOT NULL,
	"response" json,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_key" text NOT NULL,
	"notification_type" text NOT NULL,
	"recipient" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"variables" json,
	"status" text DEFAULT 'pending',
	"scheduled_at" timestamp DEFAULT now(),
	"sent_at" timestamp,
	"retry_count" integer DEFAULT 0,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"template_type" text NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"variables" json,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "notification_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_queue_id_notification_queue_id_fk" FOREIGN KEY ("queue_id") REFERENCES "public"."notification_queue"("id") ON DELETE no action ON UPDATE no action;