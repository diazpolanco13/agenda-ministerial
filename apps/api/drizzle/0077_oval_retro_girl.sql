CREATE TABLE "agenda_ntfy_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"topic_encrypted" text NOT NULL,
	"username_encrypted" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"event_task_assigned" boolean DEFAULT true NOT NULL,
	"event_mention_comment" boolean DEFAULT true NOT NULL,
	"event_due_tomorrow" boolean DEFAULT true NOT NULL,
	"event_due_today" boolean DEFAULT true NOT NULL,
	"event_overdue" boolean DEFAULT true NOT NULL,
	"event_minister_order" boolean DEFAULT true NOT NULL,
	"credentials_version" integer DEFAULT 1 NOT NULL,
	"last_test_at" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "agenda_ntfy_subscription_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "agenda_ntfy_subscription" ADD CONSTRAINT "agenda_ntfy_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "agenda_ntfy_subscription_enabled_idx" ON "agenda_ntfy_subscription" USING btree ("enabled");