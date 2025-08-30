ALTER TABLE "messages" RENAME COLUMN "roomd_id" TO "room_id";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_roomd_id_rooms_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
