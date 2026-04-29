/**
 * Health Management Dashboard — Drizzle ORM Schema
 *
 * Architecture:
 * - Append-only audit ledger (Event Sourcing / Ledger pattern)
 * - Soft deletes only (deleted_at timestamps, never physical DELETE)
 * - Active/inactive status toggles for patients
 * - Health operators = health plan companies (e.g., Unimed, Camperj)
 * - Indicator definitions with directional targets and flexible timeframes
 */

import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────

/** Audit ledger operation types */
export const ledgerOperationEnum = pgEnum("ledger_operation", [
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
  "COMPENSATE",
]);

/** Patient gender */
export const genderEnum = pgEnum("gender", [
  "masculino",
  "feminino",
  "outro",
]);

/** Patient care modality (AD = Atenção Domiciliar, ID = Internação Domiciliar) */
export const careModalityEnum = pgEnum("care_modality", ["AD", "ID"]);

/** KPI target direction */
export const targetDirectionEnum = pgEnum("target_direction", [
  "higher_is_better",
  "lower_is_better",
]);

/** KPI target timeframe */
export const targetTimeframeEnum = pgEnum("target_timeframe", [
  "monthly",
  "bimonthly",
  "quarterly",
  "quadrimestral",
  "semestral",
  "annual",
]);

/** KPI target format — determines how the value is displayed */
export const targetFormatEnum = pgEnum("target_format", [
  "percentage",
  "numeric",
]);


/** Event/occurrence primary category — maps to indicator families */
export const eventCategoryEnum = pgEnum("event_category", [
  "alta_domiciliar",          // 01 - Taxa de Altas Domiciliares
  "intercorrencia",           // 02 - Intercorrências
  "internacao_hospitalar",    // 03 - Taxa de Internação Hospitalar
  "obito",                    // 04 - Óbitos
  "alteracao_pad",            // 05 - Taxa de Alteração de PAD
  "quantitativo_paciente",    // 06 - Quantitativo de Pacientes AD/ID
  "paciente_infectado",       // 07 - Pacientes Infectados
  "evento_adverso",           // 08 - Eventos Adversos
  "ouvidoria",                // 09 - Ouvidorias
]);

/** Event sub-category — maps to indicator sub-items */
export const eventSubCategoryEnum = pgEnum("event_sub_category", [
  // 02 - Intercorrências
  "resolvida_domicilio",        // 2.1
  "remocao_aph",                // 2.2
  // 03 - Internação Hospitalar
  "deterioracao_clinica",       // 3.1
  "nao_aderencia_tratamento",   // 3.2
  // 04 - Óbitos
  "obito_menos_48h",            // 4.1
  "obito_mais_48h",             // 4.2
  // 08 - Eventos Adversos
  "queda",                      // 8.1
  "broncoaspiracao",            // 8.2
  "lesao_pressao",              // 8.3
  "decanulacao",                // 8.4
  "saida_acidental_gtt",        // 8.5
  // 09 - Ouvidorias
  "elogio",                     // 9.1
  "sugestao",                   // 9.2
  "reclamacao_solicitacao",     // 9.3
  // Categories that don't have sub-categories use null
]);

// ─────────────────────────────────────────────────────────────
// TABLES
// ─────────────────────────────────────────────────────────────

/**
 * Health Operators (Operadoras de Saúde)
 *
 * These are health plan companies (convênios), e.g. Unimed, Camperj.
 * Created strictly by name only as per spec.
 */
/** Attachment file structure stored as JSONB */
export type AttachmentFile = {
  name: string;
  size: number;
  type: string;
  data: string; // base64-encoded
};

export const healthOperators = pgTable(
  "health_operators",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),

    // File attachments
    attachments: jsonb("attachments").$type<AttachmentFile[]>().default([]),

    // Soft delete
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("health_operators_name_idx").on(table.name),
  ]
);

/**
 * Patients
 *
 * Core patient registry with demographics, care modality,
 * active/inactive toggle, and soft delete support.
 */
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    dateOfBirth: timestamp("date_of_birth", { mode: "date", withTimezone: true }),
    gender: genderEnum("gender").notNull(),
    careModality: careModalityEnum("care_modality").notNull(),

    // FK to health operator (the patient's health plan)
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => healthOperators.id),

    // Admission date
    admissionDate: timestamp("admission_date", { mode: "date", withTimezone: true }),

    // File attachments
    attachments: jsonb("attachments").$type<AttachmentFile[]>().default([]),

    // Status toggle (separate from soft delete)
    active: boolean("active").default(true).notNull(),

    // Soft delete
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("patients_operator_id_idx").on(table.operatorId),
    index("patients_active_idx").on(table.active),
    index("patients_deleted_at_idx").on(table.deletedAt),
    index("patients_care_modality_idx").on(table.careModality),
  ]
);

/**
 * Events (Occurrences)
 *
 * Medical events/occurrences linked to patients. Each event has a
 * primary category (mapping to one of the 9 indicator families) and
 * an optional sub-category for detailed classification.
 *
 * The operator_id here is denormalized from the patient's record
 * for reporting convenience (snapshot at time of event).
 */
export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Relations
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id),
    operatorId: uuid("operator_id")
      .notNull()
      .references(() => healthOperators.id),

    // Classification
    category: eventCategoryEnum("category").notNull(),
    subCategory: eventSubCategoryEnum("sub_category"),

    // Event data
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true }).notNull(),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // File attachments
    attachments: jsonb("attachments").$type<AttachmentFile[]>().default([]),

    // Soft delete
    deletedAt: timestamp("deleted_at", { mode: "date", withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("events_patient_id_idx").on(table.patientId),
    index("events_operator_id_idx").on(table.operatorId),
    index("events_category_idx").on(table.category),
    index("events_sub_category_idx").on(table.subCategory),
    index("events_occurred_at_idx").on(table.occurredAt),
    index("events_deleted_at_idx").on(table.deletedAt),
  ]
);

/**
 * Indicator Definitions
 *
 * Master list of KPI definitions. Supports hierarchical structure
 * via self-referencing parent_id (e.g., "02 Intercorrências" →
 * "02.1 Resolvidas em domicílio"). Target values are directional
 * (higher_is_better / lower_is_better) with configurable timeframes.
 */
export const indicatorDefinitions = pgTable(
  "indicator_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Display code: "01", "02", "02.1", "08.3", etc. */
    code: varchar("code", { length: 10 }).notNull().unique(),

    /** Display name in Portuguese */
    name: varchar("name", { length: 255 }).notNull(),

    /** Self-referencing parent for sub-indicators */
    parentId: uuid("parent_id"),

    /** Target value (percentage or absolute number). Null = informational only. */
    targetValue: real("target_value"),

    /** Is this target "higher is better" or "lower is better"? */
    targetDirection: targetDirectionEnum("target_direction"),

    /** How often is this target evaluated? */
    targetTimeframe: targetTimeframeEnum("target_timeframe"),

    /** Display format for the target value */
    targetFormat: targetFormatEnum("target_format").default("percentage").notNull(),

    /** True if this indicator is purely informational (no target) */
    isInformational: boolean("is_informational").default(false).notNull(),

    /** Maps to the event_category enum for automated computation */
    eventCategory: eventCategoryEnum("event_category"),

    /** Maps to the event_sub_category enum for automated computation */
    eventSubCategory: eventSubCategoryEnum("event_sub_category"),

    // Status
    active: boolean("active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("indicator_definitions_parent_id_idx").on(table.parentId),
    index("indicator_definitions_code_idx").on(table.code),
  ]
);

/**
 * Indicator Records
 *
 * Periodic snapshots of computed KPI values. Each record represents
 * the calculated value of an indicator for a specific time period.
 * Used to generate CEO reports (PDF/Excel).
 */
export const indicatorRecords = pgTable(
  "indicator_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // FK to indicator definition
    indicatorId: uuid("indicator_id")
      .notNull()
      .references(() => indicatorDefinitions.id),

    // Period boundaries
    periodStart: timestamp("period_start", { mode: "date", withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { mode: "date", withTimezone: true }).notNull(),

    // Computed data
    computedValue: real("computed_value").notNull(),

    /** Snapshot of the target at the time of computation (for historical accuracy) */
    targetValueSnapshot: real("target_value_snapshot"),

    /** Additional computation details, breakdowns, etc. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("indicator_records_indicator_period_idx").on(
      table.indicatorId,
      table.periodStart
    ),
    index("indicator_records_period_start_idx").on(table.periodStart),
  ]
);

/**
 * Audit Ledger
 *
 * Append-only log of every mutation in the system. Implements the
 * Event Sourcing / Ledger pattern. No rows are ever deleted or
 * updated — reversions are recorded as COMPENSATE entries.
 *
 * Stores full JSONB snapshots of previous and new state for
 * complete auditability.
 */
export const ledger = pgTable(
  "ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** Which table was affected */
    tableName: varchar("table_name", { length: 100 }).notNull(),

    /** ID of the affected record */
    recordId: uuid("record_id").notNull(),

    /** What operation was performed */
    operation: ledgerOperationEnum("operation").notNull(),

    /**
     * Who performed the operation.
     * Placeholder string for now; will migrate to Google Workspace emails.
     */
    performedBy: varchar("performed_by", { length: 255 }).notNull(),

    /** Full snapshot of the record BEFORE the change (null for CREATE) */
    previousState: jsonb("previous_state").$type<Record<string, unknown> | null>(),

    /** Full snapshot of the record AFTER the change (null for DELETE) */
    newState: jsonb("new_state").$type<Record<string, unknown> | null>(),

    /** When the operation was performed (server timestamp) */
    timestamp: timestamp("timestamp", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ledger_table_record_idx").on(table.tableName, table.recordId),
    index("ledger_timestamp_idx").on(table.timestamp),
    index("ledger_operation_idx").on(table.operation),
    index("ledger_performed_by_idx").on(table.performedBy),
  ]
);

// ─────────────────────────────────────────────────────────────
// RELATIONS
// ─────────────────────────────────────────────────────────────

/** Health Operators → Patients (one-to-many) */
export const healthOperatorsRelations = relations(healthOperators, ({ many }) => ({
  patients: many(patients),
  events: many(events),
}));

/** Patients → Health Operator (many-to-one), Patients → Events (one-to-many) */
export const patientsRelations = relations(patients, ({ one, many }) => ({
  operator: one(healthOperators, {
    fields: [patients.operatorId],
    references: [healthOperators.id],
  }),
  events: many(events),
}));

/** Events → Patient (many-to-one), Events → Operator (many-to-one) */
export const eventsRelations = relations(events, ({ one }) => ({
  patient: one(patients, {
    fields: [events.patientId],
    references: [patients.id],
  }),
  operator: one(healthOperators, {
    fields: [events.operatorId],
    references: [healthOperators.id],
  }),
}));

/** Indicator Definitions → Self (parent/children), → Records (one-to-many) */
export const indicatorDefinitionsRelations = relations(
  indicatorDefinitions,
  ({ one, many }) => ({
    parent: one(indicatorDefinitions, {
      fields: [indicatorDefinitions.parentId],
      references: [indicatorDefinitions.id],
      relationName: "indicator_hierarchy",
    }),
    children: many(indicatorDefinitions, {
      relationName: "indicator_hierarchy",
    }),
    records: many(indicatorRecords),
  })
);

/** Indicator Records → Indicator Definition (many-to-one) */
export const indicatorRecordsRelations = relations(indicatorRecords, ({ one }) => ({
  indicator: one(indicatorDefinitions, {
    fields: [indicatorRecords.indicatorId],
    references: [indicatorDefinitions.id],
  }),
}));
