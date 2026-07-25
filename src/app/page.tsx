import { SignedInHome } from "./signed-in-home";
import { SignedOutHome } from "./signed-out-home";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    return <SignedInHome />;
  }

  return <SignedOutHome />;
}
