import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { WalkinsClient } from "./walkins-client";

// GET /walkins — walk-in missions (auto-detected from posting text) plus YOUR
// field reports: rounds faced, questions asked, outcome. Notes only — saving
// a report never changes application status (that stays your manual tap).
export default async function WalkinsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: missions }, { data: reports }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,mission_id,title,location,deadline,employment_type,companies(name)")
      .eq("user_id", user.id)
      .or("description.ilike.%walk-in%,employment_type.ilike.%walk-in%")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from("walkin_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("visited_date", { ascending: false, nullsFirst: false }),
  ]);

  const setupNeeded = !reports && missions === null;
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle kicker="FIELD LOG" title="Walk-ins" />
      {setupNeeded ? (
        <p className="os-panel p-5 text-sm text-zinc-400">
          Setup notice: paste <code>supabase/migration_017.sql</code> once in the
          Supabase SQL Editor, then reload — your walk-in missions and reports live here.
        </p>
      ) : (
        <WalkinsClient
          missions={(missions ?? []) as never}
          reports={(reports ?? []) as never}
        />
      )}
    </div>
  );
}
