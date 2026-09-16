import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { MailsClient } from "./mails-client";

export default async function MailsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: drafts } = await supabase
    .from("email_drafts")
    .select(
      "id,to_email,subject,body,status,created_at,sent_at,jobs(id,title,mission_id,companies(id,name))",
    )
    .order("created_at", { ascending: false });

  // Pending nudges per mission — each draft shows its reminder state.
  const one = <T,>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  const jobIds = [
    ...new Set(
      (drafts ?? []).map((d) => one(d.jobs)?.id).filter((v): v is number => v != null),
    ),
  ];
  const { data: nudges } = jobIds.length
    ? await supabase.from("follow_ups").select("job_id,due_date,channel").eq("status", "PENDING").in("job_id", jobIds)
    : { data: [] };
  const nudgeByJob = new Map<number, { due: string | null; channel: string }>();
  for (const n of nudges ?? []) {
    if (n.job_id != null && !nudgeByJob.has(n.job_id))
      nudgeByJob.set(n.job_id, { due: n.due_date, channel: n.channel ?? "EMAIL" });
  }

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="OUTREACH" title="Mails — Every Draft in One Place" />
      </Reveal>
      <MailsClient
        drafts={(drafts ?? []).map((d) => ({
          ...d,
          nudge: one(d.jobs)?.id != null ? (nudgeByJob.get(one(d.jobs)!.id) ?? null) : null,
        })) as never}
      />
    </div>
  );
}
