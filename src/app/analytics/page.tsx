import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { skillDemand } from "@/lib/data";
import { kindFor, KIND_LABEL, type OppKind } from "@/lib/opportunities";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";

function Bar({ label, value, max, tone = "grad-xp" }: { label: string; value: number; max: number; tone?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className="font-bold text-cyan-200">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: jobs }, { data: apps }, { data: xpRows }, { data: appJobs }, { data: nudges }] = await Promise.all([
    supabase.from("jobs").select("id,status,source,source_type,required_skills,resume_versions(id),interview_preps(id)"),
    supabase.from("applications").select("stage"),
    supabase.from("xp_transactions").select("xp"),
    supabase.from("applications").select("stage,job_id"),
    supabase.from("follow_ups").select("id,due_date").eq("status", "PENDING"),
  ]);
  const totalXp = (xpRows ?? []).reduce((s, r) => s + (r.xp ?? 0), 0);
  const byStatus = (want: string[]) =>
    (jobs ?? []).filter((j) => want.includes((j.status ?? "").toUpperCase())).length;
  const funnel: [string, number][] = [
    ["Discovered", jobs?.length ?? 0],
    ["Ready to apply", byStatus(["RESUME READY", "READY TO APPLY"])],
    ["Applied", byStatus(["APPLIED", "OUTREACH", "WAITING"])],
    ["Interview", byStatus(["INTERVIEW", "ASSESSMENT"])],
    ["Offer", byStatus(["OFFER"])],
  ];
  const sources: Record<string, number> = {};
  (jobs ?? []).forEach((j) => {
    const s = j.source || "Unknown";
    sources[s] = (sources[s] ?? 0) + 1;
  });
  // Per-source funnel from real rows: opportunities (missions found) →
  // applications created → actually submitted → interviews → offers.
  const SUBMITTED = ["APPLIED", "OUTREACH", "WAITING"];
  const INTERVIEWED = ["INTERVIEW", "INTERVIEW SCHEDULED", "INTERVIEW COMPLETED", "FINAL ROUND", "ASSESSMENT", "SCREENING"];
  const jobById = new Map((jobs ?? []).map((j) => [j.id, j]));
  const perSource = new Map<OppKind, { opps: Set<number>; created: Set<number>; submitted: Set<number>; interviews: Set<number>; offers: Set<number> }>();
  const bucket = (k: OppKind) => {
    let b = perSource.get(k);
    if (!b) {
      b = { opps: new Set(), created: new Set(), submitted: new Set(), interviews: new Set(), offers: new Set() };
      perSource.set(k, b);
    }
    return b;
  };
  (jobs ?? []).forEach((j) => bucket(kindFor(j.source_type, j.source)).opps.add(j.id));
  (appJobs ?? []).forEach((a) => {
    const j = jobById.get(a.job_id);
    if (!j) return;
    const b = bucket(kindFor(j.source_type, j.source));
    const st = (a.stage ?? "").toUpperCase();
    b.created.add(j.id);
    if (SUBMITTED.includes(st)) b.submitted.add(j.id);
    if (INTERVIEWED.includes(st)) b.interviews.add(j.id);
    if (st === "OFFER") b.offers.add(j.id);
  });
  const funnelOrder: OppKind[] = ["LINKEDIN", "EMAIL", "CAREERS", "OTHER"];
  // Coach: plain-English advice computed from the same real rows above.
  // Every line carries its numbers; nothing renders without enough data.
  const advice: string[] = [];
  {
    const rated = funnelOrder
      .map((k) => {
        const b = perSource.get(k);
        const opps = b?.opps.size ?? 0;
        const sub = b?.submitted.size ?? 0;
        return { k, opps, sub, rate: opps >= 3 ? sub / opps : -1 };
      })
      .filter((r) => r.rate >= 0)
      .sort((a, b) => b.rate - a.rate);
    if (rated.length > 0) {
      const best = rated[0];
      advice.push(
        `${KIND_LABEL[best.k]} converts best — ${best.sub} of ${best.opps} submitted (${Math.round(best.rate * 100)}%). Feed it first.`,
      );
      const vol = [...rated].sort((a, b) => b.opps - a.opps)[0];
      if (vol.k !== best.k)
        advice.push(
          `${KIND_LABEL[vol.k]} gives most volume (${vol.opps}) but converts ${Math.round(vol.rate * 100)}% — keep it as filler, not focus.`,
        );
    }
    const noResume = (jobs ?? []).filter((j) => (j.resume_versions ?? []).length === 0).length;
    if (noResume > 0)
      advice.push(`${noResume} mission${noResume === 1 ? "" : "s"} still ${noResume === 1 ? "has" : "have"} no tailored resume — unapplied tailor-skips convert worse. Forge them from the mission page.`);
    const noPrep = (jobs ?? []).filter((j) => (j.interview_preps ?? []).length === 0).length;
    if (noPrep > 0)
      advice.push(`${noPrep} mission${noPrep === 1 ? "" : "s"} without interview prep — an interview invite there means starting cold.`);
    const overdue = (nudges ?? []).filter((n) => (n.due_date ?? "") < new Date().toISOString().slice(0, 10)).length;
    if ((nudges ?? []).length > 0)
      advice.push(`${nudges?.length} follow-up${nudges?.length === 1 ? "" : "s"} waiting${overdue > 0 ? `, ${overdue} overdue` : ""} — replies die in the inbox, not in interviews.`);
  }
  const demand = skillDemand(
    (jobs ?? []) as { required_skills: string | null }[],
  ).slice(0, 8);
  const maxD = demand[0]?.count ?? 1;

  return (
    <div className="flex flex-col gap-5">
      <Reveal>
        <SectionTitle kicker="WAR ROOM" title="Intel" />
        <div className="grid grid-cols-3 gap-3">
          {[
            ["Missions", String(jobs?.length ?? 0)],
            ["Total XP", String(totalXp)],
            ["Applications", String(apps?.length ?? 0)],
          ].map(([k, v]) => (
            <div key={k} className="os-panel p-4 text-center">
              <p className="font-display text-2xl font-bold text-white">{v}</p>
              <p className="text-[11px] tracking-widest text-zinc-500">{k.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </Reveal>
      <Reveal delay={0.05}>
        <section className="os-panel flex flex-col gap-3 p-5">
          <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">
            PIPELINE FUNNEL
          </h3>
          {funnel.map(([k, v], i) => (
            <Bar key={k} label={k} value={v} max={funnel[0][1]} tone={["grad-prep", "grad-xp", "grad-success", "grad-interview", "grad-gold"][Math.min(i, 4)]} />
          ))}
        </section>
      </Reveal>
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal delay={0.08}>
          <section className="os-panel flex flex-col gap-3 p-5">
            <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">
              SKILL DEMAND
            </h3>
            {demand.map((d) => (
              <Bar key={d.skill} label={d.skill} value={d.count} max={maxD} />
            ))}
          </section>
        </Reveal>
        <Reveal delay={0.1}>
          <section className="os-panel flex flex-col gap-3 p-5">
            <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">
              SOURCES
            </h3>
            {Object.entries(sources).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={jobs?.length ?? 1} />
            ))}
          </section>
        </Reveal>
      </div>
      <Reveal delay={0.12}>
        <section className="os-panel flex flex-col gap-4 p-5">
          <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">
            COACH SAYS
          </h3>
          {advice.length === 0 ? (
            <p className="text-sm text-zinc-400">
              Not enough history yet — capture a few more opportunities and the coach starts talking.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {advice.map((a, i) => (
                <li key={i} className="rounded-lg border border-violet-400/25 bg-violet-400/5 p-3 text-sm text-zinc-100">
                  <span className="mr-2 font-display text-xs font-bold text-violet-300">{String(i + 1).padStart(2, "0")}</span>
                  {a}
                </li>
              ))}
            </ul>
          )}
        </section>
      </Reveal>
      <Reveal delay={0.14}>
        <section className="os-panel flex flex-col gap-4 p-5">
          <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">
            WHERE OPPORTUNITIES COME FROM
          </h3>
          <p className="-mt-2 text-xs text-zinc-500">
            Real missions only — opportunities found → applications created → actually
            submitted → interviews → offers.
          </p>
          {funnelOrder.map((k) => {
            const b = perSource.get(k);
            const row: [string, number][] = [
              ["Opportunities", b?.opps.size ?? 0],
              ["Applications", b?.created.size ?? 0],
              ["Submitted", b?.submitted.size ?? 0],
              ["Interviews", b?.interviews.size ?? 0],
              ["Offers", b?.offers.size ?? 0],
            ];
            const max = Math.max(1, row[0][1]);
            return (
              <div key={k}>
                <p className="mb-1 text-xs font-bold tracking-widest text-white">
                  {KIND_LABEL[k].toUpperCase()}
                </p>
                {row.map(([label, v]) => (
                  <Bar key={label} label={label} value={v} max={max} />
                ))}
              </div>
            );
          })}
        </section>
      </Reveal>
    </div>
  );
}
