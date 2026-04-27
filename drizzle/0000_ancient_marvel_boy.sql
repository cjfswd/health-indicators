CREATE TYPE "public"."care_modality" AS ENUM('AD', 'ID');--> statement-breakpoint
CREATE TYPE "public"."event_category" AS ENUM('alta_domiciliar', 'intercorrencia', 'internacao_hospitalar', 'obito', 'alteracao_pad', 'quantitativo_paciente', 'paciente_infectado', 'evento_adverso', 'ouvidoria');--> statement-breakpoint
CREATE TYPE "public"."event_sub_category" AS ENUM('resolvida_domicilio', 'remocao_aph', 'deterioracao_clinica', 'nao_aderencia_tratamento', 'obito_menos_48h', 'obito_mais_48h', 'queda', 'broncoaspiracao', 'lesao_pressao', 'decanulacao', 'saida_acidental_gtt', 'elogio', 'sugestao', 'reclamacao_solicitacao');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('masculino', 'feminino', 'outro');--> statement-breakpoint
CREATE TYPE "public"."ledger_operation" AS ENUM('CREATE', 'UPDATE', 'DELETE', 'RESTORE', 'COMPENSATE');--> statement-breakpoint
CREATE TYPE "public"."target_direction" AS ENUM('higher_is_better', 'lower_is_better');--> statement-breakpoint
CREATE TYPE "public"."target_timeframe" AS ENUM('monthly', 'bimonthly', 'quarterly', 'quadrimestral', 'semestral', 'annual');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"operator_id" uuid NOT NULL,
	"category" "event_category" NOT NULL,
	"sub_category" "event_sub_category",
	"occurred_at" timestamp with time zone NOT NULL,
	"description" text,
	"metadata" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_operators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicator_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_id" uuid,
	"target_value" real,
	"target_direction" "target_direction",
	"target_timeframe" "target_timeframe",
	"is_informational" boolean DEFAULT false NOT NULL,
	"event_category" "event_category",
	"event_sub_category" "event_sub_category",
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "indicator_definitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "indicator_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"computed_value" real NOT NULL,
	"target_value_snapshot" real,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"record_id" uuid NOT NULL,
	"operation" "ledger_operation" NOT NULL,
	"performed_by" varchar(255) NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"date_of_birth" timestamp with time zone NOT NULL,
	"gender" "gender" NOT NULL,
	"care_modality" "care_modality" NOT NULL,
	"operator_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_operator_id_health_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."health_operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicator_records" ADD CONSTRAINT "indicator_records_indicator_id_indicator_definitions_id_fk" FOREIGN KEY ("indicator_id") REFERENCES "public"."indicator_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_operator_id_health_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."health_operators"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_patient_id_idx" ON "events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "events_operator_id_idx" ON "events" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "events_category_idx" ON "events" USING btree ("category");--> statement-breakpoint
CREATE INDEX "events_sub_category_idx" ON "events" USING btree ("sub_category");--> statement-breakpoint
CREATE INDEX "events_occurred_at_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "events_deleted_at_idx" ON "events" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "health_operators_name_idx" ON "health_operators" USING btree ("name");--> statement-breakpoint
CREATE INDEX "indicator_definitions_parent_id_idx" ON "indicator_definitions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "indicator_definitions_code_idx" ON "indicator_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "indicator_records_indicator_period_idx" ON "indicator_records" USING btree ("indicator_id","period_start");--> statement-breakpoint
CREATE INDEX "indicator_records_period_start_idx" ON "indicator_records" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "ledger_table_record_idx" ON "ledger" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "ledger_timestamp_idx" ON "ledger" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "ledger_operation_idx" ON "ledger" USING btree ("operation");--> statement-breakpoint
CREATE INDEX "ledger_performed_by_idx" ON "ledger" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX "patients_operator_id_idx" ON "patients" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "patients_active_idx" ON "patients" USING btree ("active");--> statement-breakpoint
CREATE INDEX "patients_deleted_at_idx" ON "patients" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "patients_care_modality_idx" ON "patients" USING btree ("care_modality");