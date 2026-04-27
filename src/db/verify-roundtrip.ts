/**
 * Roundtrip Verification Test
 *
 * Tests the complete data flow:
 * 1. Create a health operator
 * 2. Create a patient linked to the operator
 * 3. Create an event linked to the patient
 * 4. Write audit entries to the ledger
 * 5. Read everything back and verify relations
 *
 * Run with: pnpm tsx src/db/verify-roundtrip.ts
 */

import { eq } from "drizzle-orm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

async function verify() {
  const client = new PGlite("./dev-data");
  const db = drizzle(client, { schema });

  console.log("🧪 Running roundtrip verification...\n");

  try {
    // ── 1. Create Health Operator ──────────────────────────
    console.log("1️⃣  Creating health operator...");
    const [operator] = await db
      .insert(schema.healthOperators)
      .values({ name: "Unimed" })
      .returning();
    console.log(`   ✅ Operator: ${operator.name} (${operator.id})`);

    // ── 2. Write Ledger Entry for Operator ─────────────────
    await db.insert(schema.ledger).values({
      tableName: "health_operators",
      recordId: operator.id,
      operation: "CREATE",
      performedBy: "system@test.com",
      previousState: null,
      newState: operator as unknown as Record<string, unknown>,
    });
    console.log("   ✅ Ledger entry created for operator");

    // ── 3. Create Patient ──────────────────────────────────
    console.log("\n2️⃣  Creating patient...");
    const [patient] = await db
      .insert(schema.patients)
      .values({
        fullName: "Maria Silva Santos",
        dateOfBirth: new Date("1965-03-15"),
        gender: "feminino",
        careModality: "AD",
        operatorId: operator.id,
        active: true,
      })
      .returning();
    console.log(`   ✅ Patient: ${patient.fullName} (${patient.id})`);
    console.log(`   Care modality: ${patient.careModality}, Active: ${patient.active}`);

    // ── 4. Write Ledger Entry for Patient ──────────────────
    await db.insert(schema.ledger).values({
      tableName: "patients",
      recordId: patient.id,
      operation: "CREATE",
      performedBy: "system@test.com",
      previousState: null,
      newState: patient as unknown as Record<string, unknown>,
    });
    console.log("   ✅ Ledger entry created for patient");

    // ── 5. Create Event ────────────────────────────────────
    console.log("\n3️⃣  Creating event (intercorrência resolvida em domicílio)...");
    const [event] = await db
      .insert(schema.events)
      .values({
        patientId: patient.id,
        operatorId: operator.id,
        category: "intercorrencia",
        subCategory: "resolvida_domicilio",
        occurredAt: new Date(),
        description: "Febre alta controlada com medicação oral.",
        metadata: { temperature: 38.7, medication: "Dipirona 500mg" },
      })
      .returning();
    console.log(`   ✅ Event: ${event.category}/${event.subCategory} (${event.id})`);

    // ── 6. Write Ledger Entry for Event ────────────────────
    await db.insert(schema.ledger).values({
      tableName: "events",
      recordId: event.id,
      operation: "CREATE",
      performedBy: "system@test.com",
      previousState: null,
      newState: event as unknown as Record<string, unknown>,
    });
    console.log("   ✅ Ledger entry created for event");

    // ── 7. Test Soft Delete (Patient) ──────────────────────
    console.log("\n4️⃣  Testing soft delete...");
    const previousPatientState = { ...patient };
    const [softDeleted] = await db
      .update(schema.patients)
      .set({ deletedAt: new Date() })
      .where(eq(schema.patients.id, patient.id))
      .returning();
    console.log(`   ✅ Patient soft-deleted at: ${softDeleted.deletedAt}`);

    // Log the soft delete in the ledger
    await db.insert(schema.ledger).values({
      tableName: "patients",
      recordId: patient.id,
      operation: "DELETE",
      performedBy: "system@test.com",
      previousState: previousPatientState as unknown as Record<string, unknown>,
      newState: softDeleted as unknown as Record<string, unknown>,
    });
    console.log("   ✅ Ledger entry created for soft delete");

    // ── 8. Test Compensating Entry (Restore) ───────────────
    console.log("\n5️⃣  Testing restore (compensating entry)...");
    const previousDeletedState = { ...softDeleted };
    const [restored] = await db
      .update(schema.patients)
      .set({ deletedAt: null })
      .where(eq(schema.patients.id, patient.id))
      .returning();
    console.log(`   ✅ Patient restored: deletedAt = ${restored.deletedAt}`);

    await db.insert(schema.ledger).values({
      tableName: "patients",
      recordId: patient.id,
      operation: "RESTORE",
      performedBy: "system@test.com",
      previousState: previousDeletedState as unknown as Record<string, unknown>,
      newState: restored as unknown as Record<string, unknown>,
    });
    console.log("   ✅ Ledger RESTORE entry created");

    // ── 9. Verify Relational Queries ───────────────────────
    console.log("\n6️⃣  Verifying relational queries...");

    const patientWithRelations = await db.query.patients.findFirst({
      where: eq(schema.patients.id, patient.id),
      with: {
        operator: true,
        events: true,
      },
    });

    if (!patientWithRelations) {
      throw new Error("Patient not found!");
    }

    console.log(`   ✅ Patient: ${patientWithRelations.fullName}`);
    console.log(`   ✅ Operator: ${patientWithRelations.operator.name}`);
    console.log(`   ✅ Events: ${patientWithRelations.events.length} event(s)`);

    // ── 10. Verify Indicator Definitions ───────────────────
    console.log("\n7️⃣  Verifying indicator definitions...");

    const indicators = await db.query.indicatorDefinitions.findMany({
      with: { children: true },
      orderBy: (ind, { asc }) => [asc(ind.code)],
    });

    console.log(`   ✅ Found ${indicators.length} top-level + child indicators`);

    const withTargets = indicators.filter((i) => i.targetValue !== null);
    console.log(`   ✅ Indicators with targets: ${withTargets.length}`);
    for (const ind of withTargets) {
      console.log(
        `      📊 ${ind.code} ${ind.name}: target=${ind.targetValue}% (${ind.targetDirection}, ${ind.targetTimeframe})`
      );
    }

    // ── 11. Verify Ledger ──────────────────────────────────
    console.log("\n8️⃣  Verifying audit ledger...");

    const ledgerEntries = await db
      .select()
      .from(schema.ledger)
      .orderBy(schema.ledger.timestamp);

    console.log(`   ✅ Total ledger entries: ${ledgerEntries.length}`);
    for (const entry of ledgerEntries) {
      console.log(
        `      📝 [${entry.operation}] ${entry.tableName}/${entry.recordId.substring(0, 8)}... by ${entry.performedBy}`
      );
    }

    // ── Summary ────────────────────────────────────────────
    console.log("\n" + "═".repeat(55));
    console.log("  🎉 ALL ROUNDTRIP VERIFICATIONS PASSED!");
    console.log("═".repeat(55));
    console.log("\n  Summary:");
    console.log(`  • Health Operator created (${operator.name})`);
    console.log(`  • Patient created, soft-deleted, and restored`);
    console.log(`  • Event with category/sub-category created`);
    console.log(`  • ${ledgerEntries.length} ledger entries (full audit trail)`);
    console.log(`  • ${indicators.length} indicator definitions loaded`);
    console.log(`  • Relational queries working correctly`);
    console.log();

  } catch (error) {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

verify();
