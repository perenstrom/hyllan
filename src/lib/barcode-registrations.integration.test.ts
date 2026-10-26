import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { barcodeRegistrations, households, pantryItems } from "@/db/schema";
import {
  findBarcodeRegistration,
  registerBarcode,
} from "./barcode-registrations";
import { addPantryItem, deletePantryItem } from "./pantry-items";

const TEST_USER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_USER_ID = "44444444-4444-4444-4444-444444444444";
const BARCODE = "7310865004703";

// Same auth.users stub as pantry-items.integration.test.ts — GoTrue owns
// that table, so just enough of it to satisfy our FK.
async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });

  await client.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    INSERT INTO auth.users (id) VALUES ('${TEST_USER_ID}'), ('${OTHER_USER_ID}');
  `);

  await migrate(db, {
    migrationsFolder: path.join(process.cwd(), "drizzle"),
  });

  const [household, otherHousehold] = await db
    .insert(households)
    .values([{ userId: TEST_USER_ID }, { userId: OTHER_USER_ID }])
    .returning();

  return {
    client,
    db,
    householdId: household.id,
    otherHouseholdId: otherHousehold.id,
  };
}

describe("barcode-registrations", () => {
  let client: PGlite;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let householdId: string;
  let otherHouseholdId: string;

  beforeAll(async () => {
    ({ client, db, householdId, otherHouseholdId } = await createTestDb());
  });

  beforeEach(async () => {
    await db.delete(pantryItems);
  });

  afterAll(async () => {
    await client.close();
  });

  function addItem(name: string, inHousehold = householdId) {
    return addPantryItem(db, inHousehold, {
      name,
      quantity: "1",
      unit: "count",
    });
  }

  it("finds nothing for a barcode the household hasn't registered", async () => {
    expect(
      await findBarcodeRegistration(db, householdId, BARCODE),
    ).toBeUndefined();
  });

  it("resolves a registered barcode to its pantry item", async () => {
    const pasta = await addItem("Pasta");

    expect(
      await registerBarcode(db, householdId, {
        barcodeValue: BARCODE,
        symbology: "ean_13",
        pantryItemId: pasta.id,
        quantityPerScan: "1",
      }),
    ).toEqual({ status: "registered" });
    expect(await findBarcodeRegistration(db, householdId, BARCODE)).toEqual({
      pantryItemId: pasta.id,
      quantityPerScan: "1",
      itemName: "Pasta",
    });
  });

  it("treats registering a barcode to the item it's already on as a no-op", async () => {
    const pasta = await addItem("Pasta");
    const input = {
      barcodeValue: BARCODE,
      symbology: "ean_13" as const,
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    };

    await registerBarcode(db, householdId, input);
    expect(await registerBarcode(db, householdId, input)).toEqual({
      status: "registered",
    });
    expect(await db.select().from(barcodeRegistrations)).toHaveLength(1);
  });

  it("refuses to repoint a barcode registered to another item without an explicit reassign (ADR 0007)", async () => {
    const pasta = await addItem("Pasta");
    const rice = await addItem("Rice");
    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    });

    expect(
      await registerBarcode(db, householdId, {
        barcodeValue: BARCODE,
        symbology: "ean_13",
        pantryItemId: rice.id,
        quantityPerScan: "1",
      }),
    ).toEqual({
      status: "conflict",
      registeredTo: { id: pasta.id, name: "Pasta" },
    });
    expect(
      (await findBarcodeRegistration(db, householdId, BARCODE))?.pantryItemId,
    ).toBe(pasta.id);
  });

  it("repoints the barcode once the reassignment is confirmed", async () => {
    const pasta = await addItem("Pasta");
    const rice = await addItem("Rice");
    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    });

    expect(
      await registerBarcode(db, householdId, {
        barcodeValue: BARCODE,
        symbology: "ean_13",
        pantryItemId: rice.id,
        quantityPerScan: "1",
        reassign: true,
      }),
    ).toEqual({ status: "registered" });
    expect(await findBarcodeRegistration(db, householdId, BARCODE)).toEqual({
      pantryItemId: rice.id,
      quantityPerScan: "1",
      itemName: "Rice",
    });
  });

  it("remembers how much one scan of the barcode is", async () => {
    const pasta = await addItem("Pasta");

    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: pasta.id,
      quantityPerScan: "500",
    });

    expect(
      (await findBarcodeRegistration(db, householdId, BARCODE))
        ?.quantityPerScan,
    ).toBe("500");
  });

  it("updates the amount when a barcode is registered to its own item again", async () => {
    const pasta = await addItem("Pasta");
    const input = {
      barcodeValue: BARCODE,
      symbology: "ean_13" as const,
      pantryItemId: pasta.id,
    };
    await registerBarcode(db, householdId, { ...input, quantityPerScan: "1" });

    expect(
      await registerBarcode(db, householdId, {
        ...input,
        quantityPerScan: "0.5",
      }),
    ).toEqual({ status: "registered" });
    expect(
      (await findBarcodeRegistration(db, householdId, BARCODE))
        ?.quantityPerScan,
    ).toBe("0.5");
  });

  it("takes the new amount along with a confirmed reassignment", async () => {
    const pasta = await addItem("Pasta");
    const rice = await addItem("Rice");
    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    });

    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: rice.id,
      quantityPerScan: "2",
      reassign: true,
    });

    expect(await findBarcodeRegistration(db, householdId, BARCODE)).toEqual({
      pantryItemId: rice.id,
      itemName: "Rice",
      quantityPerScan: "2",
    });
  });

  it("lets one item carry several barcodes", async () => {
    const pasta = await addItem("Pasta");
    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    });
    await registerBarcode(db, householdId, {
      barcodeValue: "96385074",
      symbology: "ean_8",
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    });

    expect(
      (await findBarcodeRegistration(db, householdId, "96385074"))
        ?.pantryItemId,
    ).toBe(pasta.id);
    expect(
      (await findBarcodeRegistration(db, householdId, BARCODE))?.pantryItemId,
    ).toBe(pasta.id);
  });

  it("won't register a barcode to another household's item", async () => {
    const theirs = await addItem("Pasta", otherHouseholdId);

    expect(
      await registerBarcode(db, householdId, {
        barcodeValue: BARCODE,
        symbology: "ean_13",
        pantryItemId: theirs.id,
        quantityPerScan: "1",
      }),
    ).toEqual({ status: "item-not-found" });
    expect(await db.select().from(barcodeRegistrations)).toHaveLength(0);
  });

  it("scopes registrations per household — the same barcode resolves independently in each", async () => {
    const ours = await addItem("Pasta");
    const theirs = await addItem("Spaghetti", otherHouseholdId);
    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: ours.id,
      quantityPerScan: "1",
    });

    expect(
      await findBarcodeRegistration(db, otherHouseholdId, BARCODE),
    ).toBeUndefined();
    expect(
      await registerBarcode(db, otherHouseholdId, {
        barcodeValue: BARCODE,
        symbology: "ean_13",
        pantryItemId: theirs.id,
        quantityPerScan: "1",
      }),
    ).toEqual({ status: "registered" });
    expect(
      (await findBarcodeRegistration(db, householdId, BARCODE))?.itemName,
    ).toBe("Pasta");
  });

  it("deletes an item's registrations along with it", async () => {
    const pasta = await addItem("Pasta");
    await registerBarcode(db, householdId, {
      barcodeValue: BARCODE,
      symbology: "ean_13",
      pantryItemId: pasta.id,
      quantityPerScan: "1",
    });

    await deletePantryItem(db, householdId, pasta.id);

    expect(
      await findBarcodeRegistration(db, householdId, BARCODE),
    ).toBeUndefined();
  });
});
