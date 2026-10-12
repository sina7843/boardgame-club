ALTER TABLE "participants" DROP CONSTRAINT "participants_kind_chk";--> statement-breakpoint
ALTER TABLE "scheduled_deadlines" DROP CONSTRAINT "scheduled_deadlines_key_chk";--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_kind_chk" CHECK ("participants"."kind" in ('human', 'script', 'bot'));--> statement-breakpoint
ALTER TABLE "scheduled_deadlines" ADD CONSTRAINT "scheduled_deadlines_key_chk" CHECK ("scheduled_deadlines"."deadline_key" in ('turn', 'reminder', 'ready', 'bot'));