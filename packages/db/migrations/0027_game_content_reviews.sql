CREATE TABLE "game_contents" (
	"game_id" text PRIMARY KEY NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"stars" integer NOT NULL,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_reviews_one_per_user_uq" UNIQUE("game_id","user_id"),
	CONSTRAINT "game_reviews_stars_chk" CHECK ("game_reviews"."stars" between 1 and 5),
	CONSTRAINT "game_reviews_body_len_chk" CHECK (char_length("game_reviews"."body") between 3 and 1000)
);
--> statement-breakpoint
ALTER TABLE "game_contents" ADD CONSTRAINT "game_contents_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_contents" ADD CONSTRAINT "game_contents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reviews" ADD CONSTRAINT "game_reviews_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_reviews" ADD CONSTRAINT "game_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_reviews_game_idx" ON "game_reviews" USING btree ("game_id","created_at");