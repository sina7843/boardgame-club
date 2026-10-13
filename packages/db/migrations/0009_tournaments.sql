CREATE TABLE "tournament_entries" (
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"points" double precision DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"byes" integer DEFAULT 0 NOT NULL,
	"no_shows" integer DEFAULT 0 NOT NULL,
	"eliminated_round" integer,
	"final_rank" integer,
	"coin_ledger_id" uuid,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_entries_tournament_id_user_id_pk" PRIMARY KEY("tournament_id","user_id"),
	CONSTRAINT "tournament_entries_status_chk" CHECK ("tournament_entries"."status" in ('registered', 'withdrawn'))
);
--> statement-breakpoint
CREATE TABLE "tournament_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_by" uuid,
	"paid_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_refunds_paymentId_unique" UNIQUE("payment_id"),
	CONSTRAINT "tournament_refunds_status_chk" CHECK ("tournament_refunds"."status" in ('pending', 'paid'))
);
--> statement-breakpoint
CREATE TABLE "tournament_tables" (
	"table_id" uuid PRIMARY KEY NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"seats" jsonb NOT NULL,
	"absent" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placements" jsonb,
	"scored_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"title_fa" text NOT NULL,
	"description_fa" text DEFAULT '' NOT NULL,
	"format" text NOT NULL,
	"pace" text NOT NULL,
	"turn_seconds" integer NOT NULL,
	"table_size" integer NOT NULL,
	"rounds" integer,
	"advance" integer DEFAULT 1 NOT NULL,
	"min_entrants" integer NOT NULL,
	"max_entrants" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"arrival_seconds" integer DEFAULT 180 NOT NULL,
	"entry_kind" text NOT NULL,
	"entry_amount" bigint DEFAULT 0 NOT NULL,
	"prizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"current_round" integer DEFAULT 0 NOT NULL,
	"cancel_reason" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "tournaments_format_chk" CHECK ("tournaments"."format" in ('swiss', 'knockout')),
	CONSTRAINT "tournaments_pace_chk" CHECK ("tournaments"."pace" in ('live', 'turn')),
	CONSTRAINT "tournaments_entry_chk" CHECK ("tournaments"."entry_kind" in ('free', 'coins', 'toman')),
	CONSTRAINT "tournaments_status_chk" CHECK ("tournaments"."status" in ('open', 'running', 'finished', 'cancelled')),
	CONSTRAINT "tournaments_entrants_chk" CHECK ("tournaments"."min_entrants" >= 2 and "tournaments"."min_entrants" <= "tournaments"."max_entrants"),
	CONSTRAINT "tournaments_fee_chk" CHECK (("tournaments"."entry_kind" = 'free') = ("tournaments"."entry_amount" = 0) and "tournaments"."entry_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_source_chk";--> statement-breakpoint
ALTER TABLE "payments" DROP CONSTRAINT "payments_product_chk";--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tournament_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_coin_ledger_id_coin_ledger_id_fk" FOREIGN KEY ("coin_ledger_id") REFERENCES "public"."coin_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_refunds" ADD CONSTRAINT "tournament_refunds_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_refunds" ADD CONSTRAINT "tournament_refunds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_refunds" ADD CONSTRAINT "tournament_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_refunds" ADD CONSTRAINT "tournament_refunds_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_tables" ADD CONSTRAINT "tournament_tables_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_tables" ADD CONSTRAINT "tournament_tables_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournament_entries_user_idx" ON "tournament_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tournament_refunds_status_idx" ON "tournament_refunds" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "tournament_tables_round_idx" ON "tournament_tables" USING btree ("tournament_id","round");--> statement-breakpoint
CREATE INDEX "tournaments_status_idx" ON "tournaments" USING btree ("status","starts_at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_source_chk" CHECK ("entitlements"."source" in ('subscription', 'manual', 'coins', 'tournament'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_product_chk" CHECK (("payments"."plan_id" is not null)::int + ("payments"."coin_pack_id" is not null)::int + ("payments"."tournament_id" is not null)::int = 1);