/**
 * Zod Validation Schemas
 *
 * Runtime validation schemas mirroring the Drizzle ORM tables.
 * Used for API route input validation.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Shared Enums (as Zod)
// ─────────────────────────────────────────────────────────────

export const GenderSchema = z.enum(["masculino", "feminino", "outro"]);

export const CareModalitySchema = z.enum(["AD", "ID"]);

export const LedgerOperationSchema = z.enum([
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
  "COMPENSATE",
]);

export const TargetDirectionSchema = z.enum([
  "higher_is_better",
  "lower_is_better",
]);

export const TargetTimeframeSchema = z.enum([
  "monthly",
  "bimonthly",
  "quarterly",
  "quadrimestral",
  "semestral",
  "annual",
]);

export const EventCategorySchema = z.enum([
  "alta_domiciliar",
  "intercorrencia",
  "internacao_hospitalar",
  "obito",
  "alteracao_pad",
  "quantitativo_paciente",
  "paciente_infectado",
  "evento_adverso",
  "ouvidoria",
]);

export const EventSubCategorySchema = z.enum([
  "resolvida_domicilio",
  "remocao_aph",
  "deterioracao_clinica",
  "nao_aderencia_tratamento",
  "obito_menos_48h",
  "obito_mais_48h",
  "queda",
  "broncoaspiracao",
  "lesao_pressao",
  "decanulacao",
  "saida_acidental_gtt",
  "elogio",
  "sugestao",
  "reclamacao_solicitacao",
]);

// ─────────────────────────────────────────────────────────────
// Health Operator Schemas
// ─────────────────────────────────────────────────────────────

export const InsertHealthOperatorSchema = z.object({
  name: z
    .string()
    .min(1, "Nome da operadora é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
});

export const UpdateHealthOperatorSchema = InsertHealthOperatorSchema.partial();

export type InsertHealthOperator = z.infer<typeof InsertHealthOperatorSchema>;
export type UpdateHealthOperator = z.infer<typeof UpdateHealthOperatorSchema>;

// ─────────────────────────────────────────────────────────────
// Patient Schemas
// ─────────────────────────────────────────────────────────────

export const InsertPatientSchema = z.object({
  fullName: z
    .string()
    .min(1, "Nome completo é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  dateOfBirth: z.coerce.date({
    required_error: "Data de nascimento é obrigatória",
  }),
  gender: GenderSchema,
  careModality: CareModalitySchema,
  operatorId: z.string().uuid("ID da operadora inválido"),
  active: z.boolean().optional().default(true),
});

export const UpdatePatientSchema = InsertPatientSchema.partial();

export type InsertPatient = z.infer<typeof InsertPatientSchema>;
export type UpdatePatient = z.infer<typeof UpdatePatientSchema>;

// ─────────────────────────────────────────────────────────────
// Event Schemas
// ─────────────────────────────────────────────────────────────

export const InsertEventSchema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  operatorId: z.string().uuid("ID da operadora inválido"),
  category: EventCategorySchema,
  subCategory: EventSubCategorySchema.nullable().optional(),
  occurredAt: z.coerce.date({
    required_error: "Data do evento é obrigatória",
  }),
  description: z.string().max(5000).nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const UpdateEventSchema = InsertEventSchema.partial();

export type InsertEvent = z.infer<typeof InsertEventSchema>;
export type UpdateEvent = z.infer<typeof UpdateEventSchema>;

// ─────────────────────────────────────────────────────────────
// Indicator Definition Schemas
// ─────────────────────────────────────────────────────────────

export const InsertIndicatorDefinitionSchema = z.object({
  code: z
    .string()
    .min(1, "Código é obrigatório")
    .max(10, "Código deve ter no máximo 10 caracteres"),
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  parentId: z.string().uuid().nullable().optional(),
  targetValue: z.number().nullable().optional(),
  targetDirection: TargetDirectionSchema.nullable().optional(),
  targetTimeframe: TargetTimeframeSchema.nullable().optional(),
  isInformational: z.boolean().optional().default(false),
  eventCategory: EventCategorySchema.nullable().optional(),
  eventSubCategory: EventSubCategorySchema.nullable().optional(),
  active: z.boolean().optional().default(true),
});

export const UpdateIndicatorDefinitionSchema =
  InsertIndicatorDefinitionSchema.partial();

export type InsertIndicatorDefinition = z.infer<
  typeof InsertIndicatorDefinitionSchema
>;
export type UpdateIndicatorDefinition = z.infer<
  typeof UpdateIndicatorDefinitionSchema
>;

// ─────────────────────────────────────────────────────────────
// Indicator Record Schemas
// ─────────────────────────────────────────────────────────────

export const InsertIndicatorRecordSchema = z.object({
  indicatorId: z.string().uuid("ID do indicador inválido"),
  periodStart: z.coerce.date({ required_error: "Início do período é obrigatório" }),
  periodEnd: z.coerce.date({ required_error: "Fim do período é obrigatório" }),
  computedValue: z.number(),
  targetValueSnapshot: z.number().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export type InsertIndicatorRecord = z.infer<typeof InsertIndicatorRecordSchema>;

// ─────────────────────────────────────────────────────────────
// Ledger Schemas (for validation, not direct insertion)
// ─────────────────────────────────────────────────────────────

export const LedgerEntrySchema = z.object({
  tableName: z.string().min(1).max(100),
  recordId: z.string().uuid(),
  operation: LedgerOperationSchema,
  performedBy: z.string().min(1).max(255),
  previousState: z.record(z.unknown()).nullable().optional(),
  newState: z.record(z.unknown()).nullable().optional(),
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// ─────────────────────────────────────────────────────────────
// Query / Filter Schemas (for API endpoints)
// ─────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const DateRangeFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export const PatientFilterSchema = PaginationSchema.merge(
  DateRangeFilterSchema
).extend({
  search: z.string().optional(),
  active: z.coerce.boolean().optional(),
  careModality: CareModalitySchema.optional(),
  operatorId: z.string().uuid().optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export const EventFilterSchema = PaginationSchema.merge(
  DateRangeFilterSchema
).extend({
  patientId: z.string().uuid().optional(),
  operatorId: z.string().uuid().optional(),
  category: EventCategorySchema.optional(),
  subCategory: EventSubCategorySchema.optional(),
  includeDeleted: z.coerce.boolean().optional().default(false),
});

export const LedgerFilterSchema = PaginationSchema.merge(
  DateRangeFilterSchema
).extend({
  tableName: z.string().optional(),
  recordId: z.string().uuid().optional(),
  operation: LedgerOperationSchema.optional(),
  performedBy: z.string().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;
export type DateRangeFilter = z.infer<typeof DateRangeFilterSchema>;
export type PatientFilter = z.infer<typeof PatientFilterSchema>;
export type EventFilter = z.infer<typeof EventFilterSchema>;
export type LedgerFilter = z.infer<typeof LedgerFilterSchema>;
