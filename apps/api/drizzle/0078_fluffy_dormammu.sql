CREATE TABLE "daily_brief_sent" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"date_key" text NOT NULL,
	"channels" text[] DEFAULT '{}' NOT NULL,
	"sent_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "daily_brief_sent_unique" UNIQUE("user_id","workspace_id","date_key")
);
--> statement-breakpoint
CREATE TABLE "order_escalation_sent" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"level" text NOT NULL,
	"recipient_user_id" text NOT NULL,
	"sent_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "order_escalation_sent_unique" UNIQUE("task_id","level","recipient_user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_order_counter" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"year" integer NOT NULL,
	"last_seq" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	CONSTRAINT "workspace_order_counter_ws_year_unique" UNIQUE("workspace_id","year")
);
--> statement-breakpoint
ALTER TABLE "agenda_ntfy_subscription" ADD COLUMN "event_escalation" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "agenda_ntfy_subscription" ADD COLUMN "event_daily_brief" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "discurso_borrador" ADD COLUMN "asistentes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "confidentiality_level" text DEFAULT 'publica_interna' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "confidentiality_level" text DEFAULT 'publica_interna' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "is_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_folio" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_origin" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_quote" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_closure_status" text DEFAULT 'abierta' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_evidence_text" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_evidence_asset_id" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_evidence_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_evidence_submitted_by" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_review_comment" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "order_seal_hash" text;--> statement-breakpoint
ALTER TABLE "daily_brief_sent" ADD CONSTRAINT "daily_brief_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_brief_sent" ADD CONSTRAINT "daily_brief_sent_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_escalation_sent" ADD CONSTRAINT "order_escalation_sent_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "order_escalation_sent" ADD CONSTRAINT "order_escalation_sent_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "workspace_order_counter" ADD CONSTRAINT "workspace_order_counter_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "daily_brief_sent_date_idx" ON "daily_brief_sent" USING btree ("date_key");--> statement-breakpoint
CREATE INDEX "order_escalation_sent_task_idx" ON "order_escalation_sent" USING btree ("task_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_order_evidence_submitted_by_user_id_fk" FOREIGN KEY ("order_evidence_submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_order_reviewed_by_user_id_fk" FOREIGN KEY ("order_reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "task_is_order_idx" ON "task" USING btree ("is_order");--> statement-breakpoint
CREATE INDEX "task_order_folio_idx" ON "task" USING btree ("order_folio");--> statement-breakpoint
CREATE INDEX "task_confidentiality_idx" ON "task" USING btree ("confidentiality_level");