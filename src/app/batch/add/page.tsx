import { notFound } from "next/navigation";

import { AppHeader } from "@/app/app-header";
import { BatchEntryPrototypePageBody } from "@/app/batch-entry-prototype-page-body";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listPantryItems } from "@/lib/pantry-items";

// PER-278 prototype infrastructure — Variant B's split path (a dedicated
// Add entry point, camera live and persistent) as a real page rather than
// a <dialog>, per review feedback on the ticket. Never linked from
// production nav (see signed-in-home.tsx's isPrototypeBuild gate) — this
// route only exists on the throwaway prototype branch.
export default async function BatchAddPrototypePage() {
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
        direction="add"
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
