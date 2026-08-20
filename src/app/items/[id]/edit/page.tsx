import { notFound } from "next/navigation";

import { EditItemForm } from "./edit-item-form";
import { AppHeader } from "@/app/app-header";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { activeBuckets } from "@/lib/location";
import { listLocations } from "@/lib/locations";
import { getPantryItem } from "@/lib/pantry-items";
import type { PantryItemWithLocations } from "@/lib/pantry-items";

type Props = {
  params: Promise<{ id: string }>;
};

// Editing sets one (item, location) bucket's quantity absolutely (ADR
// 0005's per-location model), never the item's derived total directly, so
// the form needs one bucket to default to. A single-bucket item is
// unambiguous — that's the bucket. A multi-location item defaults to its
// actual unassigned bucket instead of guessing which location the user
// meant to edit, so leaving the field untouched and submitting is a no-op
// against that bucket rather than silently overwriting a location's
// quantity the user never looked at.
function defaultEditBucket(item: PantryItemWithLocations) {
  const buckets = activeBuckets(item.buckets);
  if (buckets.length === 1) {
    return { locationId: buckets[0].locationId, quantity: buckets[0].quantity };
  }
  const unassigned = item.buckets.find((bucket) => bucket.locationId === null);
  return { locationId: null, quantity: unassigned?.quantity ?? "0" };
}

export default async function EditItemPage({ params }: Props) {
  const { id } = await params;

  const { claims } = await requireSessionClaims();

  const household = await getHouseholdForUser(db, claims.sub);
  const [item, locations] = await Promise.all([
    getPantryItem(db, household.id, id),
    listLocations(db, household.id),
  ]);

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <EditItemForm
        item={{ ...item, ...defaultEditBucket(item) }}
        locations={locations}
      />
    </div>
  );
}
