import { notFound } from "next/navigation";

import { EditItemForm } from "./edit-item-form";
import { AppHeader } from "@/app/app-header";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { getPantryItem } from "@/lib/pantry-items";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditItemPage({ params }: Props) {
  const { id } = await params;

  const { claims } = await requireSessionClaims();

  const household = await getHouseholdForUser(db, claims.sub);
  const item = await getPantryItem(db, household.id, id);

  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <EditItemForm item={item} />
    </div>
  );
}
