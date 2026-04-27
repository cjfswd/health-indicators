ALTER TABLE "events" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "health_operators" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "admission_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb;