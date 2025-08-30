CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid,
	"category_id" uuid,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"price" numeric(8, 2) NOT NULL,
	"is_available" boolean DEFAULT true,
	"preparation_time" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"cuisine_type" varchar,
	"address" varchar(500),
	"city" varchar(100),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"phone" varchar(20),
	"email" varchar(100) NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0',
	"total_reviews" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"is_verified" boolean DEFAULT false,
	"delivery_fee" numeric(8, 2) DEFAULT '3.00',
	"minimum_order" numeric(8, 2) DEFAULT '1.00',
	"estimated_prep_time" integer DEFAULT 10,
	"is_open" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "restaurant_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "menu_categories" ADD CONSTRAINT "menu_categories_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurant_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_menu_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."menu_categories"("id") ON DELETE cascade ON UPDATE no action;