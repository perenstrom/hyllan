import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import {
  barcodeProductNames,
  barcodeRegistrations,
  households,
  pantryItems,
} from "@/db/schema";
import {
  findBarcodeRegistration,
  listItemBarcodeRegistrations,
  registerBarcode,
  removeBarcodeRegistration,
  updateBarcodeQuantityPerScan,
} from "./barcode-registrations";
import { addPantryItem, deletePantryItem, getPantryItem } from "./pantry-items";

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
    await db.delete(barcodeProductNames);
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

  describe("managing an item's registrations", () => {
    const EAN_8 = "96385074";
    const UPC_A_CANONICAL = "0036000291452";

    async function register(
      pantryItemId: string,
      barcodeValue: string,
      symbology: "ean_13" | "upc_a" | "ean_8" = "ean_13",
      inHousehold = householdId,
    ) {
      await registerBarcode(db, inHousehold, {
        barcodeValue,
        symbology,
        pantryItemId,
        quantityPerScan: "1",
      });
      const [row] = await db
        .select({ id: barcodeRegistrations.id })
        .from(barcodeRegistrations)
        .where(eq(barcodeRegistrations.barcodeValue, barcodeValue));
      return row.id;
    }

    it("lists an item's registrations with any cached product name", async () => {
      const pasta = await addItem("Pasta");
      await register(pasta.id, BARCODE);
      await register(pasta.id, UPC_A_CANONICAL, "upc_a");
      await db.insert(barcodeProductNames).values([
        {
          barcodeValue: BARCODE,
          productName: "Fusilli",
          source: "open_food_facts",
        },
        // A cached miss shows no name.
        { barcodeValue: UPC_A_CANONICAL, productName: null, source: null },
      ]);

      expect(
        await listItemBarcodeRegistrations(db, householdId, pasta.id),
      ).toEqual([
        {
          id: expect.any(String),
          barcodeValue: BARCODE,
          symbology: "ean_13",
          quantityPerScan: "1",
          productName: { name: "Fusilli", source: "open_food_facts" },
        },
        {
          id: expect.any(String),
          barcodeValue: UPC_A_CANONICAL,
          symbology: "upc_a",
          quantityPerScan: "1",
          productName: null,
        },
      ]);
    });

    it("lists only that item's registrations, and only within the household", async () => {
      const pasta = await addItem("Pasta");
      const rice = await addItem("Rice");
      await register(pasta.id, BARCODE);
      await register(rice.id, EAN_8);

      expect(
        (await listItemBarcodeRegistrations(db, householdId, pasta.id)).map(
          (registration) => registration.barcodeValue,
        ),
      ).toEqual([BARCODE]);
      expect(
        await listItemBarcodeRegistrations(db, otherHouseholdId, pasta.id),
      ).toEqual([]);
    });

    it("removes one registration, leaving the item and its other barcodes alone", async () => {
      const pasta = await addPantryItem(db, householdId, {
        name: "Pasta",
        quantity: "3",
        unit: "count",
      });
      const removed = await register(pasta.id, BARCODE);
      await register(pasta.id, EAN_8);

      expect(await removeBarcodeRegistration(db, householdId, removed)).toBe(
        true,
      );

      expect(
        await findBarcodeRegistration(db, householdId, BARCODE),
      ).toBeUndefined();
      expect(
        (await findBarcodeRegistration(db, householdId, EAN_8))?.pantryItemId,
      ).toBe(pasta.id);
      expect((await getPantryItem(db, householdId, pasta.id))?.quantity).toBe(
        "3",
      );
    });

    it("reports not-found when removing another household's registration, and leaves it", async () => {
      const theirs = await addItem("Pasta", otherHouseholdId);
      const id = await register(theirs.id, BARCODE, "ean_13", otherHouseholdId);

      expect(await removeBarcodeRegistration(db, householdId, id)).toBe(false);
      expect(
        await findBarcodeRegistration(db, otherHouseholdId, BARCODE),
      ).toBeDefined();
    });

    it("changes one registration's per-scan amount", async () => {
      const pasta = await addItem("Pasta");
      const id = await register(pasta.id, BARCODE);

      expect(
        await updateBarcodeQuantityPerScan(db, householdId, id, "500"),
      ).toBe(true);
      expect(
        (await findBarcodeRegistration(db, householdId, BARCODE))
          ?.quantityPerScan,
      ).toBe("500");
    });

    it("reports not-found when changing another household's per-scan amount, and leaves it", async () => {
      const theirs = await addItem("Pasta", otherHouseholdId);
      const id = await register(theirs.id, BARCODE, "ean_13", otherHouseholdId);

      expect(
        await updateBarcodeQuantityPerScan(db, householdId, id, "500"),
      ).toBe(false);
      expect(
        (await findBarcodeRegistration(db, otherHouseholdId, BARCODE))
          ?.quantityPerScan,
      ).toBe("1");
    });
  });
});
