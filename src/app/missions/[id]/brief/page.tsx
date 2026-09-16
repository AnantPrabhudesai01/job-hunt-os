import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";

// GET /missions/[id]/brief — interview-day mode. Everything about one interview
// on one screen, assembled from the mission's real rows: logistics, people,
// arsenal status, plus a fixed preparation checklist (general guidance, the
// mission-specific facts come from the rows above it).
export default async function InterviewBrief({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("jobs")
    .select(
      "mission_id,title,location,work_mode,employment_type,description,deadline,companies(name,website),applications(stage,date_applied),resume_versions(file_name,version_label),email_drafts(to_email,subject,status),interview_preps(status)",
    )
    .eq("id", id)
    .single();
  if (!job) notFound();
  const j = job as unknown as {
    mission_id: string; title: string; location: string | null; work_mode: string | null;
    employment_type: string | null; description: string | null; deadline: string | null;
    companies: { name?: string; website?: string } | null;
    applications: { stage: string | null }[];
    resume_versions: { file_name: string; version_label: string }[];
    email_drafts: { to_email: string; subject: string; status: string }[];
    interview_preps: { status: string | null }[];
  };
  const companyId = (
    await supabase.from("jobs").select("company_id").eq("id", id).single()
  ).data?.company_id as number | null;
  const { data: people } = companyId
    ? await supabase.from("contacts").select("name,role_title,email,phone").eq("company_id", companyId)
    : { data: [] as { name: string; role_title: string | null; email: string | null; phone: string | null }[] };
  const { data: nudges } = await supabase
    .from("follow_ups")
    .select("due_date,contact_name,channel")
    .eq("job_id", Number(id))
    .eq("status", "PENDING")
    .order("due_date")
    .limit(3);

  const stage = j.applications?.[0]?.stage ?? "—";
  const arsenal: [string, string][] = [
    ["Resume", j.resume_versions.length > 0 ? `${j.resume_versions[0].file_name} (${j.resume_versions[0].version_label})` : "NOT READY — forge from mission page"],
    ["Mail thread", j.email_drafts.length > 0 ? `${j.email_drafts.length} draft(s), latest: ${j.email_drafts[j.email_drafts.length - 1].status}` : "None"],
    ["Interview prep", j.interview_preps.length > 0 ? "READY" : "NOT READY — build before the call"],
  ];

  return (
    <div className="flex flex-col gap-5">
      <Reveal>
        <section className="os-panel p-5">
          <p className="font-display text-[11px] font-bold tracking-[0.2em] text-cyan-300">
            INTERVIEW BRIEF · MISSION {j.mission_id} · {stage}
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-white">{j.title}</h1>
          <p className="text-sm text-zinc-400">
            {j.companies?.name} · {j.location}
            {j.work_mode ? ` · ${j.work_mode}` : ""}
            {j.employment_type ? ` · ${j.employment_type}` : ""}
          </p>
          {j.deadline && (
            <p className="mt-1 text-sm text-amber-200">Deadline: {j.deadline}</p>
          )}
          <Link href={`/missions/${id}`} className="mt-2 inline-block text-sm text-cyan-300">
            ← Back to mission
          </Link>
        </section>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal delay={0.03}>
          <section className="os-panel p-5">
            <SectionTitle kicker="PEOPLE" title="Who you'll face" />
            {(people ?? []).length === 0 ? (
              <p className="text-sm text-zinc-400">No contacts on file — check the post for a name.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(people ?? []).map((c, i) => (
                  <li key={i} className="rounded-lg border os-hud-line p-3 text-sm">
                    <span className="font-semibold text-white">{c.name}</span>
                    <span className="block text-xs text-zinc-400">
                      {c.role_title ?? ""}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.phone ? ` · ${c.phone}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {(nudges ?? []).length > 0 && (
              <p className="mt-2 text-xs text-amber-200">
                Pending follow-up: {(nudges ?? [])[0].due_date} — {(nudges ?? [])[0].contact_name ?? "someone"} ({(nudges ?? [])[0].channel ?? "?"})
              </p>
            )}
          </section>
        </Reveal>
        <Reveal delay={0.05}>
          <section className="os-panel p-5">
            <SectionTitle kicker="ARSENAL" title="What you carry in" />
            <ul className="flex flex-col gap-1.5 text-sm">
              {arsenal.map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-200">{k}</span>
                  <span className={`truncate text-xs ${v.startsWith("NOT") || v === "None" ? "text-zinc-500" : "text-emerald-300"}`}>{v}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      </div>

      {j.description && (
        <Reveal delay={0.07}>
          <section className="os-panel p-5">
            <SectionTitle kicker="INTEL" title="Role facts (from posting)" />
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{j.description}</p>
          </section>
        </Reveal>
      )}

      <Reveal delay={0.09}>
        <section className="os-panel p-5">
          <SectionTitle kicker="RITUAL" title="Night before" />
          <ul className="flex flex-col gap-1.5 text-sm text-zinc-200">
            {[
              "Re-read the role facts above — know 3 things the team actually does.",
              "Prepare 3 resume stories: hardest bug, fastest delivery, proudest feature.",
              "Prepare 5 questions: role scope, team, growth, tech challenges, next steps.",
              "Confirm logistics: time, link/address, interviewer names, documents.",
              "Sleep. A tired fresher loses to a rested one with half the skill.",
            ].map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </section>
      </Reveal>
      <Reveal delay={0.11}>
        <section className="os-panel p-5">
          <SectionTitle kicker="RITUAL" title="Day of + after" />
          <ul className="flex flex-col gap-1.5 text-sm text-zinc-200">
            {[
              "Join 10 minutes early. Resume + ID + notebook open before hello.",
              "Answer in STAR shape: situation, task, action, result — with numbers.",
              "Ask your 5 questions. Never say 'no questions'.",
              "Same evening: thank-you note + log outcome on the mission page.",
              "Status changes stay manual — flip it only after reality, never hope.",
            ].map((t, i) => (
              <li key={i}>• {t}</li>
            ))}
          </ul>
        </section>
      </Reveal>
    </div>
  );
}
