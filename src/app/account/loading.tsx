import { AuthenticatedLoading } from "@/app/authenticated-loading";

export default function Loading() {
  return (
    <AuthenticatedLoading className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black" />
  );
}
