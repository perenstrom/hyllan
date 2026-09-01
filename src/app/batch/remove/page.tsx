import { notFound } from "next/navigation";

import { AppHeader } from "@/app/app-header";
import { BatchEntryPrototypePageBody } from "@/app/batch-entry-prototype-page-body";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listPantryItems } from "@/lib/pantry-items";

// PER-278 prototype infrastructure — see src/app/batch/add/page.tsx for the
// rationale; this is its Remove counterpart.
export default async function BatchRemovePrototypePage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  const items = await listPantryItems(db, household.id);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <BatchEntryPrototypePageBody
        direction="remove"
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          quantity: Number(item.quantity),
        }))}
      />
    </div>
  );
}
