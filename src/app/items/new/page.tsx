import { AddItemForm } from "./add-item-form";
import { AppHeader } from "@/app/app-header";
import { requireSessionClaims } from "@/lib/auth";

export default async function NewItemPage() {
  await requireSessionClaims();

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <AddItemForm />
    </div>
  );
}
