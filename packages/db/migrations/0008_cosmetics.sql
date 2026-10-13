CREATE TABLE "user_cosmetics" (
	"user_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"ledger_id" uuid NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_cosmetics_user_id_item_key_pk" PRIMARY KEY("user_id","item_key")
);
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_target_chk";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "title_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banner_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "favorite_games" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "showcase" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_ledger_id_coin_ledger_id_fk" FOREIGN KEY ("ledger_id") REFERENCES "public"."coin_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_chk" CHECK ("reports"."target_type" in ('user', 'display_name', 'bio', 'message', 'table'));