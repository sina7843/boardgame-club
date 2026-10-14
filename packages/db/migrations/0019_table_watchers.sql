CREATE TABLE "table_watchers" (
	"table_id" uuid NOT NULL,
	"socket_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "table_watchers_table_id_socket_id_pk" PRIMARY KEY("table_id","socket_id")
);
--> statement-breakpoint
ALTER TABLE "table_watchers" ADD CONSTRAINT "table_watchers_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_watchers" ADD CONSTRAINT "table_watchers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;