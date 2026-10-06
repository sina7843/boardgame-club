CREATE TABLE "appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sanction_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "appeals_sanctionId_unique" UNIQUE("sanction_id"),
	CONSTRAINT "appeals_status_chk" CHECK ("appeals"."status" in ('open', 'upheld', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "behavior_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "behavior_signals_once_uq" UNIQUE("table_id","user_id","kind"),
	CONSTRAINT "behavior_signals_kind_chk" CHECK ("behavior_signals"."kind" in ('timeout_loss', 'resigned', 'ready_no_show'))
);
--> statement-breakpoint
CREATE TABLE "table_invites" (
	"table_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_invites_table_id_user_id_pk" PRIMARY KEY("table_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_mutes" (
	"muter_id" uuid NOT NULL,
	"muted_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_mutes_muter_id_muted_id_pk" PRIMARY KEY("muter_id","muted_id")
);
--> statement-breakpoint
CREATE TABLE "user_sanctions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"report_id" uuid,
	"created_by" uuid NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	CONSTRAINT "user_sanctions_kind_chk" CHECK ("user_sanctions"."kind" in ('suspended', 'chat_restricted', 'warning'))
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"dm_policy" text DEFAULT 'friends' NOT NULL,
	"notify" jsonb DEFAULT '{"turn":true,"invite":true,"message":true,"result":true,"social":true}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_dm_chk" CHECK ("user_settings"."dm_policy" in ('friends', 'nobody'))
);
--> statement-breakpoint
ALTER TABLE "scheduled_deadlines" DROP CONSTRAINT "scheduled_deadlines_key_chk";--> statement-breakpoint
DROP INDEX "matchmaking_queue_idx";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "direct_key" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_message_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "is_matchmade" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "tutorial_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "matchmaking_tickets" ADD COLUMN "turn_seconds" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "matchmaking_tickets" ADD COLUMN "rating" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "matchmaking_tickets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "matchmaking_tickets" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "subject_user_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reason_code" text DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "decision" text;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_sanction_id_user_sanctions_id_fk" FOREIGN KEY ("sanction_id") REFERENCES "public"."user_sanctions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_signals" ADD CONSTRAINT "behavior_signals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "behavior_signals" ADD CONSTRAINT "behavior_signals_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_invites" ADD CONSTRAINT "table_invites_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_invites" ADD CONSTRAINT "table_invites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_invites" ADD CONSTRAINT "table_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_muter_id_users_id_fk" FOREIGN KEY ("muter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_mutes" ADD CONSTRAINT "user_mutes_muted_id_users_id_fk" FOREIGN KEY ("muted_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sanctions" ADD CONSTRAINT "user_sanctions_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "behavior_signals_user_idx" ON "behavior_signals" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "user_sanctions_user_idx" ON "user_sanctions" USING btree ("user_id","kind");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_scope_uq" ON "conversations" USING btree ("kind","scope_id") WHERE scope_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "matchmaking_one_active_uq" ON "matchmaking_tickets" USING btree ("user_id") WHERE status in ('queued', 'matched');--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id","scope_type");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "matchmaking_queue_idx" ON "matchmaking_tickets" USING btree ("game_id","pace","competition","player_count","turn_seconds","status");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_directKey_unique" UNIQUE("direct_key");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reason_chk" CHECK ("reports"."reason_code" in ('abuse', 'spam', 'cheating', 'inappropriate_name', 'other'));--> statement-breakpoint
ALTER TABLE "scheduled_deadlines" ADD CONSTRAINT "scheduled_deadlines_key_chk" CHECK ("scheduled_deadlines"."deadline_key" in ('turn', 'reminder', 'ready'));