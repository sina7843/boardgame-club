CREATE TABLE "coin_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"rule_id" text NOT NULL,
	"reason" text NOT NULL,
	"source_key" text NOT NULL,
	"result_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coin_ledger_sourceKey_unique" UNIQUE("source_key"),
	CONSTRAINT "coin_ledger_amount_chk" CHECK ("coin_ledger"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "coin_packs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"title_fa" text NOT NULL,
	"coins" integer NOT NULL,
	"price_amount" bigint,
	"currency" text DEFAULT 'IRR' NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "coin_packs_key_unique" UNIQUE("key"),
	CONSTRAINT "coin_packs_coins_chk" CHECK ("coin_packs"."coins" > 0),
	CONSTRAINT "coin_packs_price_chk" CHECK ("coin_packs"."price_amount" is null or "coin_packs"."price_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "entitlements" DROP CONSTRAINT "entitlements_source_chk";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "plan_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "coin_pack_id" uuid;--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coin_ledger" ADD CONSTRAINT "coin_ledger_result_id_game_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."game_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coin_ledger_user_idx" ON "coin_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_coin_pack_id_coin_packs_id_fk" FOREIGN KEY ("coin_pack_id") REFERENCES "public"."coin_packs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_source_chk" CHECK ("entitlements"."source" in ('subscription', 'manual', 'coins'));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_product_chk" CHECK (("payments"."plan_id" is null) <> ("payments"."coin_pack_id" is null));