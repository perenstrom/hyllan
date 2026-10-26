import { and, asc, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import * as schema from "@/db/schema";
import {
  barcodeProductNames,
  barcodeRegistrations,
  pantryItems,
} from "@/db/schema";
import type { BarcodeSymbology } from "./barcode";
import type { ProductNameSuggestion } from "./product-names";

// Same query-result-generic shape as pantry-items.ts, so these run against
// both the app's postgres-js client and PGlite in integration tests.
type Database<TQueryResult extends PgQueryResultHKT = PgQueryResultHKT> =
  PgDatabase<TQueryResult, typeof schema>;

export type BarcodeRegistrationMatch = {
  pantryItemId: string;
  itemName: string;
  quantityPerScan: string;
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
      quantityPerScan: barcodeRegistrations.quantityPerScan,
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
  // Positive, already parsed (parseQuantity) — in the item's own unit.
  quantityPerScan: string;
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
        quantityPerScan: input.quantityPerScan,
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

    // Registering a barcode to the item it's already on is how its amount
    // gets changed ("Wrong item?" and picking the same item again).
    if (existing.pantryItemId === input.pantryItemId) {
      await tx
        .update(barcodeRegistrations)
        .set({ quantityPerScan: input.quantityPerScan })
        .where(eq(barcodeRegistrations.id, existing.id));
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
      .set({
        pantryItemId: input.pantryItemId,
        symbology: input.symbology,
        quantityPerScan: input.quantityPerScan,
      })
      .where(eq(barcodeRegistrations.id, existing.id));
    return { status: "registered" };
  });
}

export type ItemBarcodeRegistration = {
  id: string;
  barcodeValue: string;
  symbology: BarcodeSymbology;
  quantityPerScan: string;
  // From the shared name cache (ADR 0008) — null when it has no row for
  // the value or only a cached miss.
  productName: ProductNameSuggestion | null;
};

// What the edit-item page's Barcodes section lists, oldest first so a
// newly scanned registration lands at the bottom.
export async function listItemBarcodeRegistrations<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  pantryItemId: string,
): Promise<ItemBarcodeRegistration[]> {
  const rows = await db
    .select({
      id: barcodeRegistrations.id,
      barcodeValue: barcodeRegistrations.barcodeValue,
      symbology: barcodeRegistrations.symbology,
      quantityPerScan: barcodeRegistrations.quantityPerScan,
      productName: barcodeProductNames.productName,
      source: barcodeProductNames.source,
    })
    .from(barcodeRegistrations)
    .leftJoin(
      barcodeProductNames,
      eq(barcodeRegistrations.barcodeValue, barcodeProductNames.barcodeValue),
    )
    .where(
      and(
        eq(barcodeRegistrations.householdId, householdId),
        eq(barcodeRegistrations.pantryItemId, pantryItemId),
      ),
    )
    .orderBy(asc(barcodeRegistrations.createdAt), asc(barcodeRegistrations.id));

  return rows.map(({ productName, source, ...registration }) => ({
    ...registration,
    productName: productName && source ? { name: productName, source } : null,
  }));
}

function scopedToRegistration(householdId: string, registrationId: string) {
  return and(
    eq(barcodeRegistrations.householdId, householdId),
    eq(barcodeRegistrations.id, registrationId),
  );
}

// Drops one registration without touching its item — scanning the barcode
// again simply starts inline registration over. False when no such
// registration exists in the household.
export async function removeBarcodeRegistration<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  registrationId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(barcodeRegistrations)
    .where(scopedToRegistration(householdId, registrationId))
    .returning({ id: barcodeRegistrations.id });
  return deleted.length > 0;
}

// quantityPerScan: positive, already parsed (parseQuantity), in the item's
// own unit. False when no such registration exists in the household.
export async function updateBarcodeQuantityPerScan<
  TQueryResult extends PgQueryResultHKT,
>(
  db: Database<TQueryResult>,
  householdId: string,
  registrationId: string,
  quantityPerScan: string,
): Promise<boolean> {
  const updated = await db
    .update(barcodeRegistrations)
    .set({ quantityPerScan })
    .where(scopedToRegistration(householdId, registrationId))
    .returning({ id: barcodeRegistrations.id });
  return updated.length > 0;
}
