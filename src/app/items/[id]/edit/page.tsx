import { notFound, redirect } from "next/navigation";

import { EditItemForm } from "./edit-item-form";
import { AppHeader } from "@/app/app-header";
import { db } from "@/db/client";
import { getHouseholdForUser } from "@/lib/household";
import { getPantryItem } from "@/lib/pantry-items";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditItemPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  const household = await getHouseholdForUser(db, data.claims.sub);
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
