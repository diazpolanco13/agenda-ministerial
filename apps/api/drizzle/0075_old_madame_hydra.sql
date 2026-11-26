CREATE TABLE "discurso_borrador" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by" text NOT NULL,
	"titulo" text NOT NULL,
	"fuente_tipo" text DEFAULT 'texto' NOT NULL,
	"fuente_referencia" text,
	"fecha_discurso" timestamp,
	"texto_original" text NOT NULL,
	"motor_usado" text DEFAULT 'reglas' NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"ordenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tareas_creadas" integer DEFAULT 0 NOT NULL,
	"aprobado_en" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discurso_borrador" ADD CONSTRAINT "discurso_borrador_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "discurso_borrador" ADD CONSTRAINT "discurso_borrador_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "discurso_borrador_workspace_idx" ON "discurso_borrador" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "discurso_borrador_created_by_idx" ON "discurso_borrador" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "discurso_borrador_estado_idx" ON "discurso_borrador" USING btree ("estado");