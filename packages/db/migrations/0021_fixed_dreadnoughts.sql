ALTER TABLE "tournament_entries" ADD COLUMN "bye_rounds" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN "requested_byes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN "checked_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN "buchholz" double precision;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN "sonneborn_berger" double precision;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN "disqualified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN "disqualified_reason" text;--> statement-breakpoint
ALTER TABLE "tournament_tables" ADD COLUMN "overridden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "options" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "checkin_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "round_gap_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "next_round_at" timestamp with time zone;