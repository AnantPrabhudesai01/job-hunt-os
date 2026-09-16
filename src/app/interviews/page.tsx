import { redirect } from "next/navigation";
import Link from "next/link";
import { Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export default async function InterviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: preps } = await supabase
    .from("interview_preps")
    .select("id,status,research_date,storage_path,jobs(id,mission_id,title,companies(name))")
    .order("created_at", { ascending: false });

  // No scheduled-interview table yet: any mission in INTERVIEW stage is a live boss.
  const { data: live } = await supabase
    .from("jobs")
    .select("id,mission_id,title,updated_at,companies(name)")
    .in("status", ["INTERVIEW", "ASSESSMENT", "FINAL ROUND"]);

  // Battle power per live boss: prep pack + tailored resume present (real rows).
  const liveIds = (live ?? []).map((b) => b.id);
  const [{ data: livePreps }, { data: liveResumes }, { data: liveDrafts }] = liveIds.length
    ? await Promise.all([
        supabase.from("interview_preps").select("job_id").in("job_id", liveIds),
        supabase.from("resume_versions").select("job_id").in("job_id", liveIds),
        supabase.from("email_drafts").select("job_id").in("job_id", liveIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const prepJobs = new Set((livePreps ?? []).map((p) => p.job_id));
  const resumeJobs = new Set((liveResumes ?? []).map((r) => r.job_id));
  const draftJobs = new Set((liveDrafts ?? []).map((r) => r.job_id));
  const powerFor = (id: number) => (prepJobs.has(id) ? 50 : 0) + (resumeJobs.has(id) ? 50 : 0);
  const waitingDays = (iso: string | null) =>
    iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null;

  return (
    <div className="flex flex-col gap-5">
      <Reveal>
        <SectionTitle kicker="BOSS ROOM" title="Interviews" />
        {!live || live.length === 0 ? (
          <EmptyState
            title="NO BOSS BATTLES YET"
            body="No interview scheduled. When a call comes, tell me the company and date — it becomes a Boss Battle with countdown and readiness plan."
          />
        ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {live.map((b) => (
                <li key={b.id} className="os-panel relative overflow-hidden border-red-400/40 p-4 shadow-[0_0_36px_rgba(239,68,68,0.18)]">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-1 grad-boss" aria-hidden />
                  <p className="font-display flex items-center gap-2 font-bold text-white">
                    <Swords size={16} className="text-red-300" aria-hidden />
                    {(b.companies as { name?: string } | null)?.name} — {b.title}
                  </p>
                  <p className="text-xs text-zinc-400">{b.mission_id}</p>
                  <div className="mt-2 flex items-center gap-2" aria-label={`Battle power ${powerFor(b.id)} percent`}>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
                      <div className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-400 to-emerald-400" style={{ width: `${powerFor(b.id)}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-zinc-300">
                      {powerFor(b.id) === 100 ? "BATTLE READY" : powerFor(b.id) === 50 ? "CHARGING" : "UNARMED"}
                    </span>
                  </div>
                <Link
                  href={`/missions/${b.id}`}
                  className="mt-2 inline-block rounded-md bg-red-500/20 border border-red-400/40 px-3 py-1 text-sm font-semibold text-red-200"
                >
                  Enter battle prep
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal delay={0.05}>
        <SectionTitle kicker="ARSENAL" title="Preparation packs" />
        {!preps || preps.length === 0 ? (
          <p className="text-sm text-zinc-400">No prep packs built yet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {preps.map((p) => {
              const job = p.jobs as unknown as {
                id: number;
                mission_id: string;
                title: string;
                companies: { name?: string } | null;
              } | null;
              return (
                <li key={p.id} className="card-hover os-panel p-4">
                  <p className="font-semibold text-white">
                    {job?.companies?.name} · {job?.title}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {job?.mission_id} · Researched {p.research_date} ·{" "}
                    {p.status}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {job && (
                      <Link
                        href={`/missions/${job.id}`}
                        className="rounded-md border os-hud-line px-2.5 py-1 text-xs hover:text-white"
                      >
                        Open mission
                      </Link>
                    )}
                    {p.storage_path ? (
                      <a
                        href={`/api/vault/download?path=${encodeURIComponent(p.storage_path)}`}
                        className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="rounded-md border border-dashed os-hud-line px-2.5 py-1 text-xs text-zinc-500">
                        Cloud sync pending
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
