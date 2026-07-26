import { SignedInHome } from "./signed-in-home";
import { SignedOutHome } from "./signed-out-home";
import { db } from "@/db/client";
import { getSessionClaims } from "@/lib/auth";
import { getHouseholdForUser } from "@/lib/household";
import { listPantryItems } from "@/lib/pantry-items";

export default async function Home() {
  const { claims } = await getSessionClaims();

  if (!claims) {
    return <SignedOutHome />;
  }

  const household = await getHouseholdForUser(db, claims.sub);
  const items = await listPantryItems(db, household.id);

  return <SignedInHome items={items} />;
}
