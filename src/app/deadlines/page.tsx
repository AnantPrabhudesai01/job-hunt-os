import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { DeadlinesLive } from "@/components/deadlines-live";

// Deadlines, dedicated: every dated mission with escalation tiers, plus all
// pending nudges. The dashboard keeps its compact widget; this is the wall.
export default async function DeadlinesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: deadlines }, { data: follows }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,mission_id,title,deadline,applications(stage,date_applied)")
      .not("deadline", "is", null)
      .order("deadline"),
    supabase.from("follow_ups").select("id,due_date").eq("status", "PENDING"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="CHRONO WALL" title={`Deadlines (${(deadlines ?? []).length})`} />
        <DeadlinesLive
          items={(deadlines ?? []).map((d) => ({
            id: d.id,
            mission: d.mission_id,
            title: d.title,
            deadline: d.deadline as string,
            stage: d.applications?.[0]?.stage ?? "NOT APPLIED",
            dateApplied: d.applications?.[0]?.date_applied ?? null,
          }))}
          followups={(follows ?? []).map((f) => ({ id: f.id, due: f.due_date }))}
        />
      </Reveal>
    </div>
  );
}
