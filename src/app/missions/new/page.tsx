import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewMissionClient } from "./new-mission-client";

export default async function NewMissionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading intake form…</p>}>
      <NewMissionClient />
    </Suspense>
  );
}
