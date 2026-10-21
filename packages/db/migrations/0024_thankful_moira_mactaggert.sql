CREATE TABLE "fair_play_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"accused_id" uuid NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fair_play_reports_once_uq" UNIQUE("table_id","reporter_id","accused_id"),
	CONSTRAINT "fair_play_reports_status_chk" CHECK ("fair_play_reports"."status" in ('open', 'dismissed', 'actioned'))
);
--> statement-breakpoint
CREATE TABLE "move_times" (
	"table_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"seat" integer NOT NULL,
	"action_type" text NOT NULL,
	"spent_ms" integer NOT NULL,
	"lag_ms" integer DEFAULT 0 NOT NULL,
	"left_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "move_times_table_id_revision_pk" PRIMARY KEY("table_id","revision")
);
--> statement-breakpoint
CREATE TABLE "table_focus_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"table_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"hidden" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tournament_tables" ADD COLUMN "playoff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "playoff" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "playoff_table_id" uuid;--> statement-breakpoint
ALTER TABLE "fair_play_reports" ADD CONSTRAINT "fair_play_reports_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fair_play_reports" ADD CONSTRAINT "fair_play_reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fair_play_reports" ADD CONSTRAINT "fair_play_reports_accused_id_users_id_fk" FOREIGN KEY ("accused_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fair_play_reports" ADD CONSTRAINT "fair_play_reports_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "move_times" ADD CONSTRAINT "move_times_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_focus_events" ADD CONSTRAINT "table_focus_events_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_focus_events" ADD CONSTRAINT "table_focus_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fair_play_reports_status_idx" ON "fair_play_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "table_focus_table_idx" ON "table_focus_events" USING btree ("table_id","created_at");