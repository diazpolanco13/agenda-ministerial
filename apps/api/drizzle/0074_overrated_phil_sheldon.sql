CREATE TABLE "militar_perfil" (
	"user_id" text PRIMARY KEY NOT NULL,
	"cedula" text NOT NULL,
	"nacionalidad" text,
	"grado" text,
	"componente" text,
	"unidad" text,
	"sexo" text,
	"pendiente" boolean DEFAULT false NOT NULL,
	"sincronizado_en" timestamp,
	"created_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL,
	"updated_at" timestamp DEFAULT (now() AT TIME ZONE 'utc') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "militar_perfil" ADD CONSTRAINT "militar_perfil_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "militar_perfil_cedula_idx" ON "militar_perfil" USING btree ("cedula");