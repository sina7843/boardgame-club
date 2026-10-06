CREATE TABLE "fake_gateway_transactions" (
	"authority" text PRIMARY KEY NOT NULL,
	"amount" bigint NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL,
	"paid_amount" bigint,
	"ref_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fake_gateway_decision_chk" CHECK ("fake_gateway_transactions"."decision" in ('pending', 'paid', 'failed', 'delayed', 'wrong_amount'))
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"payment_id" uuid,
	"provider" text NOT NULL,
	"authority" text,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_status_chk";--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "premium_host_invites_free" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "league_placements" ADD COLUMN "rating" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "league_placements" ADD COLUMN "ranked_games" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "league_placements" ADD COLUMN "corrected_by" uuid;--> statement-breakpoint
ALTER TABLE "league_placements" ADD COLUMN "correction_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "authority" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "expires_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "duration_days" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "terms_fa" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rating_history" ADD COLUMN "place" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "rating_history" ADD COLUMN "field_size" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "rating_history" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "last_played_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD COLUMN "source_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD COLUMN "game_id" text;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "seasons" ADD COLUMN "closed_by" uuid;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_placements" ADD CONSTRAINT "league_placements_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_history" ADD CONSTRAINT "rating_history_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_provider_authority_uq" ON "payments" USING btree ("provider","authority");--> statement-breakpoint
CREATE INDEX "payments_user_idx" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "rating_history_user_idx" ON "rating_history" USING btree ("user_id","game_id","mode","created_at");--> statement-breakpoint
CREATE INDEX "ratings_board_idx" ON "ratings" USING btree ("game_id","mode");--> statement-breakpoint
CREATE INDEX "reward_ledger_user_idx" ON "reward_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_one_active_uq" ON "seasons" USING btree ((true)) WHERE status = 'active';--> statement-breakpoint
ALTER TABLE "reward_ledger" ADD CONSTRAINT "reward_ledger_sourceKey_unique" UNIQUE("source_key");--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_source_chk" CHECK ("entitlements"."source" in ('subscription', 'manual'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_chk" CHECK ("payments"."amount" > 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status_chk" CHECK ("payments"."status" in ('pending', 'verified', 'failed', 'expired'));--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_price_chk" CHECK ("plans"."price_amount" is null or "plans"."price_amount" > 0);--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_dates_chk" CHECK ("seasons"."starts_at" < "seasons"."ends_at");--> statement-breakpoint
-- Closed seasons are frozen: placements can change only inside a transaction that set app.season_correction
-- (the audited admin correction endpoint). Hand-written; not derived from the Drizzle schema.
CREATE OR REPLACE FUNCTION league_placement_freeze() RETURNS trigger AS $$
BEGIN
  IF (SELECT status FROM seasons WHERE id = COALESCE(NEW.season_id, OLD.season_id)) = 'closed'
     AND coalesce(current_setting('app.season_correction', true), '') <> 'on' THEN
    RAISE EXCEPTION 'season is closed; use the audited correction path' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER league_placements_freeze BEFORE INSERT OR UPDATE OR DELETE ON league_placements
  FOR EACH ROW EXECUTE FUNCTION league_placement_freeze();
