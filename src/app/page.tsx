import { SignedInHome } from "./signed-in-home";
import { SignedOutHome } from "./signed-out-home";
import { db } from "@/db/client";
import { getSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listLocations } from "@/lib/locations";
import { listPantryItems } from "@/lib/pantry-items";

export default async function Home() {
  const { claims } = await getSessionClaims();

  if (!claims) {
    return <SignedOutHome />;
  }

  const household = await getHouseholdForUser(db, claims.sub);
  const [items, locations] = await Promise.all([
    listPantryItems(db, household.id),
    listLocations(db, household.id),
  ]);

  return <SignedInHome items={items} locations={locations} />;
}
