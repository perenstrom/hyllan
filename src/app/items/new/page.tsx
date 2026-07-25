import { redirect } from "next/navigation";

import { AddItemForm } from "./add-item-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewItemPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) {
    redirect("/login");
  }

  return <AddItemForm />;
}
