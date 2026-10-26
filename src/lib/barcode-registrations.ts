import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import { barcodeRegistrations, pantryItems } from "@/db/schema";
import type { BarcodeSymbology } from "./barcode";

// Same query-result-generic shape as pantry-items.ts, so these run against
// both the app's postgres-js client and PGlite in integration tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export type BarcodeRegistrationMatch = {
  pantryItemId: string;
  itemName: string;
};

// barcodeValue must already be canonical (canonicalBarcodeValue) — the
// lookup is a plain equality on the stored value.
export async function findBarcodeRegistration<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  barcodeValue: string,
): Promise<BarcodeRegistrationMatch | undefined> {
  const [match] = await db
    .select({
      pantryItemId: barcodeRegistrations.pantryItemId,
      itemName: pantryItems.name,
    })
    .from(barcodeRegistrations)
    .innerJoin(
      pantryItems,
      eq(barcodeRegistrations.pantryItemId, pantryItems.id),
    )
    .where(
      and(
        eq(barcodeRegistrations.householdId, householdId),
        eq(barcodeRegistrations.barcodeValue, barcodeValue),
      ),
    );
  return match;
}

export type RegisterBarcodeInput = {
  barcodeValue: string;
  symbology: BarcodeSymbology;
  pantryItemId: string;
  // Repointing a barcode already on another item has to be confirmed by
  // the household first (ADR 0007) — without this, that case reports a
  // conflict instead of overwriting.
  reassign?: boolean;
};

export type RegisterBarcodeResult =
  | { status: "registered" }
  | { status: "conflict"; registeredTo: { id: string; name: string } }
  | { status: "item-not-found" };

export async function registerBarcode<TQueryResult extends PgQueryResultHKT>(
  db: Database<TQueryResult>,
  householdId: string,
  input: RegisterBarcodeInput,
): Promise<RegisterBarcodeResult> {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select({ id: pantryItems.id })
      .from(pantryItems)
      .where(
        and(
          eq(pantryItems.householdId, householdId),
          eq(pantryItems.id, input.pantryItemId),
        ),
      );
    if (!item) {
      return { status: "item-not-found" };
    }

    // Insert-or-nothing first, so two concurrent first registrations of the
    // same barcode can't both succeed — the loser falls through to the
    // existing-row path below like any other already-registered barcode.
    const inserted = await tx
      .insert(barcodeRegistrations)
      .values({
        householdId,
        pantryItemId: input.pantryItemId,
        barcodeValue: input.barcodeValue,
        symbology: input.symbology,
      })
      .onConflictDoNothing()
      .returning({ id: barcodeRegistrations.id });
    if (inserted.length > 0) {
      return { status: "registered" };
    }

    const [existing] = await tx
      .select({
        id: barcodeRegistrations.id,
        pantryItemId: barcodeRegistrations.pantryItemId,
        itemName: pantryItems.name,
      })
      .from(barcodeRegistrations)
      .innerJoin(
        pantryItems,
        eq(barcodeRegistrations.pantryItemId, pantryItems.id),
      )
      .where(
        and(
          eq(barcodeRegistrations.householdId, householdId),
          eq(barcodeRegistrations.barcodeValue, input.barcodeValue),
        ),
      )
      .for("update", { of: barcodeRegistrations });

    if (existing.pantryItemId === input.pantryItemId) {
      return { status: "registered" };
    }
    if (!input.reassign) {
      return {
        status: "conflict",
        registeredTo: { id: existing.pantryItemId, name: existing.itemName },
      };
    }

    await tx
      .update(barcodeRegistrations)
      .set({ pantryItemId: input.pantryItemId, symbology: input.symbology })
      .where(eq(barcodeRegistrations.id, existing.id));
    return { status: "registered" };
  });
}
