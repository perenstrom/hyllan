import { LocationsManager } from "./locations-manager";
import { AppHeader } from "@/app/app-header";
import { PANEL_MAIN_CLASS } from "@/app/panel-styles";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listLocations } from "@/lib/locations";
import { listPantryItems } from "@/lib/pantry-items";

export default async function LocationsPage() {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  const [locations, items] = await Promise.all([
    listLocations(db, household.id),
    listPantryItems(db, household.id),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className={PANEL_MAIN_CLASS}>
        <LocationsManager locations={locations} items={items} />
      </main>
    </div>
  );
}
