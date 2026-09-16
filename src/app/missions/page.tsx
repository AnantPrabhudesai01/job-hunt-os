import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMissions } from "@/lib/data";
import MissionsClient from "./missions-client";

export default async function MissionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const missions = await getMissions();
  return <MissionsClient missions={missions} />;
}
