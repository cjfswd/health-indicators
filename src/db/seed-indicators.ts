/**
 * Indicator Definitions Seed
 *
 * Populates the indicator_definitions table with all 9 indicator
 * families and their sub-items, matching the specification.
 *
 * Run with: pnpm db:seed
 */

import { eq } from "drizzle-orm";
import { db, getPGliteClient } from "./dev-database";
import { indicatorDefinitions, healthOperators } from "./schema";

interface IndicatorSeed {
  code: string;
  name: string;
  parentCode?: string;
  targetValue?: number;
  targetDirection?: "higher_is_better" | "lower_is_better";
  targetTimeframe?:
    | "monthly"
    | "bimonthly"
    | "quarterly"
    | "quadrimestral"
    | "semestral"
    | "annual";
  isInformational?: boolean;
  eventCategory?:
    | "alta_domiciliar"
    | "intercorrencia"
    | "internacao_hospitalar"
    | "obito"
    | "alteracao_pad"
    | "quantitativo_paciente"
    | "paciente_infectado"
    | "evento_adverso"
    | "ouvidoria";
  eventSubCategory?:
    | "resolvida_domicilio"
    | "remocao_aph"
    | "deterioracao_clinica"
    | "nao_aderencia_tratamento"
    | "obito_menos_48h"
    | "obito_mais_48h"
    | "queda"
    | "broncoaspiracao"
    | "lesao_pressao"
    | "decanulacao"
    | "saida_acidental_gtt"
    | "elogio"
    | "sugestao"
    | "reclamacao_solicitacao";
}

const INDICATORS: IndicatorSeed[] = [
  // ── 01 ─ Taxa de Altas Domiciliares ────────────────────
  {
    code: "01",
    name: "Taxa de Altas Domiciliares",
    targetValue: 10,
    targetDirection: "higher_is_better",
    targetTimeframe: "quarterly",
    eventCategory: "alta_domiciliar",
  },

  // ── 02 ─ Nº de Intercorrências ─────────────────────────
  {
    code: "02",
    name: "Nº de Intercorrências",
    isInformational: true,
    eventCategory: "intercorrencia",
  },
  {
    code: "02.1",
    name: "Resolvidas em domicílio",
    parentCode: "02",
    isInformational: true,
    eventCategory: "intercorrencia",
    eventSubCategory: "resolvida_domicilio",
  },
  {
    code: "02.2",
    name: "Necessidade de Remoção APH",
    parentCode: "02",
    isInformational: true,
    eventCategory: "intercorrencia",
    eventSubCategory: "remocao_aph",
  },

  // ── 03 ─ Taxa de Internação Hospitalar ──────────────────
  {
    code: "03",
    name: "Taxa de Internação Hospitalar",
    isInformational: true,
    eventCategory: "internacao_hospitalar",
  },
  {
    code: "03.1",
    name: "Deterioração clínica",
    parentCode: "03",
    isInformational: true,
    eventCategory: "internacao_hospitalar",
    eventSubCategory: "deterioracao_clinica",
  },
  {
    code: "03.2",
    name: "Não aderência ao tratamento",
    parentCode: "03",
    isInformational: true,
    eventCategory: "internacao_hospitalar",
    eventSubCategory: "nao_aderencia_tratamento",
  },

  // ── 04 ─ Nº de Óbitos ──────────────────────────────────
  {
    code: "04",
    name: "Nº de óbitos",
    isInformational: true,
    eventCategory: "obito",
  },
  {
    code: "04.1",
    name: "Menos de 48 horas após implantação",
    parentCode: "04",
    isInformational: true,
    eventCategory: "obito",
    eventSubCategory: "obito_menos_48h",
  },
  {
    code: "04.2",
    name: "Mais de 48 horas de implantação",
    parentCode: "04",
    isInformational: true,
    eventCategory: "obito",
    eventSubCategory: "obito_mais_48h",
  },

  // ── 05 ─ Taxa de Alteração de PAD ──────────────────────
  {
    code: "05",
    name: "Taxa de alteração de PAD",
    isInformational: true,
    eventCategory: "alteracao_pad",
  },

  // ── 06 ─ Quantitativo de Pacientes AD e ID ─────────────
  {
    code: "06",
    name: "Quantitativo de pacientes AD e ID (total absoluto e individual)",
    isInformational: true,
    eventCategory: "quantitativo_paciente",
  },

  // ── 07 ─ Nº de Pacientes Infectados ────────────────────
  {
    code: "07",
    name: "Nº de pacientes infectados (Início de uso de antibiótico em 48h)",
    targetValue: 5,
    targetDirection: "lower_is_better",
    targetTimeframe: "monthly",
    eventCategory: "paciente_infectado",
  },

  // ── 08 ─ Nº de Eventos Adversos ────────────────────────
  {
    code: "08",
    name: "Nº de eventos adversos",
    isInformational: true,
    eventCategory: "evento_adverso",
  },
  {
    code: "08.1",
    name: "Quedas",
    parentCode: "08",
    isInformational: true,
    eventCategory: "evento_adverso",
    eventSubCategory: "queda",
  },
  {
    code: "08.2",
    name: "Broncoaspiração",
    parentCode: "08",
    isInformational: true,
    eventCategory: "evento_adverso",
    eventSubCategory: "broncoaspiracao",
  },
  {
    code: "08.3",
    name: "Lesão por pressão",
    parentCode: "08",
    isInformational: true,
    eventCategory: "evento_adverso",
    eventSubCategory: "lesao_pressao",
  },
  {
    code: "08.4",
    name: "Decanulação",
    parentCode: "08",
    isInformational: true,
    eventCategory: "evento_adverso",
    eventSubCategory: "decanulacao",
  },
  {
    code: "08.5",
    name: "Saída acidental da GTT",
    parentCode: "08",
    isInformational: true,
    eventCategory: "evento_adverso",
    eventSubCategory: "saida_acidental_gtt",
  },

  // ── 09 ─ Nº de Ouvidorias ──────────────────────────────
  {
    code: "09",
    name: "Nº de ouvidorias",
    isInformational: true,
    eventCategory: "ouvidoria",
  },
  {
    code: "09.1",
    name: "Elogios",
    parentCode: "09",
    isInformational: true,
    eventCategory: "ouvidoria",
    eventSubCategory: "elogio",
  },
  {
    code: "09.2",
    name: "Sugestões",
    parentCode: "09",
    isInformational: true,
    eventCategory: "ouvidoria",
    eventSubCategory: "sugestao",
  },
  {
    code: "09.3",
    name: "Reclamações e Solicitações",
    parentCode: "09",
    isInformational: true,
    eventCategory: "ouvidoria",
    eventSubCategory: "reclamacao_solicitacao",
  },
];

async function seed() {
  // ── Seed Health Operators ──────────────────────────────
  console.log("🌱 Seeding health operators...\n");
  const existingOps = await db.select().from(healthOperators);
  if (existingOps.length > 0) {
    console.log(`⚠️  Found ${existingOps.length} existing operators. Skipping.`);
  } else {
    for (const name of ["Unimed", "Camperj"]) {
      await db.insert(healthOperators).values({ name });
      console.log(`  ✅ ${name}`);
    }
    console.log("");
  }

  // ── Seed Indicator Definitions ─────────────────────────
  console.log("🌱 Seeding indicator definitions...\n");

  // Check if indicators already exist
  const existing = await db.select().from(indicatorDefinitions);
  if (existing.length > 0) {
    console.log(
      `⚠️  Found ${existing.length} existing indicator definitions. Skipping seed.`
    );
    console.log('   To re-seed, clear the indicator_definitions table first.');
    return;
  }

  // First pass: insert parent indicators (no parentCode)
  const parentIndicators = INDICATORS.filter((i) => !i.parentCode);
  const codeToId = new Map<string, string>();

  for (const indicator of parentIndicators) {
    const [inserted] = await db
      .insert(indicatorDefinitions)
      .values({
        code: indicator.code,
        name: indicator.name,
        targetValue: indicator.targetValue ?? null,
        targetDirection: indicator.targetDirection ?? null,
        targetTimeframe: indicator.targetTimeframe ?? null,
        isInformational: indicator.isInformational ?? false,
        eventCategory: indicator.eventCategory ?? null,
        eventSubCategory: indicator.eventSubCategory ?? null,
      })
      .returning({ id: indicatorDefinitions.id });

    codeToId.set(indicator.code, inserted.id);
    console.log(`  ✅ ${indicator.code} — ${indicator.name}`);
  }

  // Second pass: insert child indicators (with parentCode)
  const childIndicators = INDICATORS.filter((i) => i.parentCode);

  for (const indicator of childIndicators) {
    const parentId = codeToId.get(indicator.parentCode!);
    if (!parentId) {
      console.error(
        `  ❌ Parent code "${indicator.parentCode}" not found for ${indicator.code}`
      );
      continue;
    }

    const [inserted] = await db
      .insert(indicatorDefinitions)
      .values({
        code: indicator.code,
        name: indicator.name,
        parentId,
        targetValue: indicator.targetValue ?? null,
        targetDirection: indicator.targetDirection ?? null,
        targetTimeframe: indicator.targetTimeframe ?? null,
        isInformational: indicator.isInformational ?? false,
        eventCategory: indicator.eventCategory ?? null,
        eventSubCategory: indicator.eventSubCategory ?? null,
      })
      .returning({ id: indicatorDefinitions.id });

    codeToId.set(indicator.code, inserted.id);
    console.log(`  ✅ ${indicator.code} — ${indicator.name}`);
  }

  console.log(
    `\n🎉 Seeded ${codeToId.size} indicator definitions successfully.`
  );
}

async function main() {
  try {
    await seed();
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    const client = getPGliteClient();
    await client.close();
  }
}

main();
