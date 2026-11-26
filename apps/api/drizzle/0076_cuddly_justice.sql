CREATE TABLE "user_saved_filter" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"scope" text DEFAULT 'my-tasks' NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_ui_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"font_scale" text DEFAULT 'normal' NOT NULL,
	"high_contrast" boolean DEFAULT false NOT NULL,
	"reduce_motion" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "user_saved_filter" ADD CONSTRAINT "user_saved_filter_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_saved_filter" ADD CONSTRAINT "user_saved_filter_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_ui_preference" ADD CONSTRAINT "user_ui_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "user_saved_filter_user_ws_scope_idx" ON "user_saved_filter" USING btree ("user_id","workspace_id","scope");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_createdBy_idx" ON "task" USING btree ("created_by");