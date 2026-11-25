ALTER TABLE "participants" ADD COLUMN "extra_time_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vacation_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "vacation_last_ended_at" timestamp with time zone;