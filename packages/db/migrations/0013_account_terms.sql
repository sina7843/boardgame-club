ALTER TABLE "users" DROP CONSTRAINT "users_status_chk";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_chk" CHECK ("users"."status" in ('active', 'suspended', 'deleted'));