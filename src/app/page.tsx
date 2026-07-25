import { SignedInHome } from "./signed-in-home";
import { SignedOutHome } from "./signed-out-home";
import { db } from "@/db/client";
import { getHouseholdForUser } from "@/lib/household";
import { listPantryItems } from "@/lib/pantry-items";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    return <SignedOutHome />;
  }

  const household = await getHouseholdForUser(db, data.claims.sub);
  const items = await listPantryItems(db, household.id);

  return <SignedInHome items={items} />;
}
