CREATE TABLE "onboarding_progress" (
	"user_id" uuid NOT NULL,
	"tour_key" text NOT NULL,
	"steps" text[] DEFAULT '{}'::text[] NOT NULL,
	"dismissed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_progress_user_id_tour_key_pk" PRIMARY KEY("user_id","tour_key")
);
--> statement-breakpoint
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;