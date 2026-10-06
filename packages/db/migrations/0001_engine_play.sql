CREATE TABLE "platform_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reason_fa" text NOT NULL,
	"started_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tutorial_progress" (
	"user_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"status" text NOT NULL,
	"table_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "tutorial_progress_user_id_game_id_pk" PRIMARY KEY("user_id","game_id"),
	CONSTRAINT "tutorial_progress_status_chk" CHECK ("tutorial_progress"."status" in ('in_progress', 'completed', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_table_seat_uq";--> statement-breakpoint
ALTER TABLE "participants" DROP CONSTRAINT "participants_table_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "participants" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_table_id_seat_pk" PRIMARY KEY("table_id","seat");--> statement-breakpoint
ALTER TABLE "game_snapshots" ADD COLUMN "rng" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "capacity" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "is_tutorial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "tutorial_step" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedupe_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "participants" ADD COLUMN "kind" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_incidents" ADD CONSTRAINT "platform_incidents_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutorial_progress" ADD CONSTRAINT "tutorial_progress_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_incidents_one_open_uq" ON "platform_incidents" USING btree ((true)) WHERE ended_at is null;--> statement-breakpoint
CREATE INDEX "participants_user_idx" ON "participants" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_deadlines_one_pending_uq" ON "scheduled_deadlines" USING btree ("table_id","deadline_key") WHERE status = 'pending';--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_inviteCode_unique" UNIQUE("invite_code");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_dedupeKey_unique" UNIQUE("dedupe_key");--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_table_user_uq" UNIQUE("table_id","user_id");--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_capacity_chk" CHECK ("game_tables"."capacity" between 1 and 16);--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_kind_chk" CHECK ("participants"."kind" in ('human', 'script'));--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_chk" CHECK (("participants"."kind" = 'human') = ("participants"."user_id" is not null));--> statement-breakpoint
ALTER TABLE "scheduled_deadlines" ADD CONSTRAINT "scheduled_deadlines_key_chk" CHECK ("scheduled_deadlines"."deadline_key" in ('turn', 'reminder'));