import { AddItemForm } from "./add-item-form";
import { AppHeader } from "@/app/app-header";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listLocations } from "@/lib/locations";

type Props = {
  searchParams: Promise<{ name?: string | string[] }>;
};

export default async function NewItemPage({ searchParams }: Props) {
  const { name } = await searchParams;
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  const locations = await listLocations(db, household.id);

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <AddItemForm
        locations={locations}
        initialName={typeof name === "string" ? name : undefined}
      />
    </div>
  );
}
