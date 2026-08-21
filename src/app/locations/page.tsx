import { LocationsManager } from "./locations-manager";
import { AppHeader } from "@/app/app-header";
import { db } from "@/db/client";
import { requireSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listLocations } from "@/lib/locations";

export default async function LocationsPage() {
  const { claims } = await requireSessionClaims();
  const household = await getHouseholdForUser(db, claims.sub);
  const locations = await listLocations(db, household.id);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <AppHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8">
        <LocationsManager locations={locations} />
      </main>
    </div>
  );
}
