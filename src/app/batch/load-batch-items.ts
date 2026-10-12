import type { BatchItemOption } from "./batch-entry-row";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listPantryItems } from "@/lib/pantry-items";

// Shared by the Add and Remove batch-entry pages: the household's items,
// fetched server-side the same way the pantry list does, narrowed to what
// the entry row's picker needs.
export async function loadBatchItems(): Promise<BatchItemOption[]> {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  const items = await listPantryItems(db, household.id);
  return items.map(({ id, name, unit, quantity }) => ({
    id,
    name,
    unit,
    quantity,
  }));
}
