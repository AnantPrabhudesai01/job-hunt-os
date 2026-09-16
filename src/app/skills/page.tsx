import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { skillDemand } from "@/lib/data";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { DsaLogger } from "@/components/dsa-logger";

// Verified-profile baseline (Anant, Sep 2026). Levels rise only via logged study/practice.
const BASELINE: Record<string, { level: string; pct: number }> = {
  JavaScript: { level: "Strong", pct: 80 },
  Python: { level: "Interview Ready", pct: 55 },
  SQL: { level: "Strong", pct: 80 },
  REST: { level: "Strong", pct: 85 },
  Git: { level: "Strong", pct: 85 },
  Java: { level: "Interview Ready", pct: 60 },
  React: { level: "Strong", pct: 80 },
  Node: { level: "Interview Ready", pct: 65 },
};

const TREE: { branch: string; nodes: string[]; color: string; bar: string }[] = [
  { branch: "Programming", nodes: ["JavaScript", "Python", "Java"], color: "text-sky-300", bar: "grad-prep" },
  { branch: "Web & Backend", nodes: ["React", "Node", "REST"], color: "text-emerald-300", bar: "grad-success" },
  { branch: "Data & Tools", nodes: ["SQL", "Git"], color: "text-cyan-300", bar: "grad-xp" },
];

export default async function SkillsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: jobs } = await supabase.from("jobs").select("required_skills");
  const { data: solves } = await supabase
    .from("dsa_solves")
    .select("title,topic,difficulty,verdict,solved_at")
    .order("id", { ascending: false })
    .limit(30);
  const demand = skillDemand(
    (jobs ?? []) as { required_skills: string | null }[],
  );
  const byName = Object.fromEntries(demand.map((d) => [d.skill, d.count]));

  return (
    <div className="flex flex-col gap-5">
      <Reveal>
        <SectionTitle kicker="PROGRESSION" title="Skill tree" />
        <p className="mb-4 text-sm text-zinc-400">
          Demand = missions requesting it (live). Level = verified baseline —
          rises only when you log real study or practice.
        </p>
      </Reveal>
      {TREE.map((b, bi) => (
        <Reveal key={b.branch} delay={bi * 0.05}>
          <section className="os-panel p-4">
            <h3 className={`font-display text-sm font-bold tracking-widest ${b.color}`}>
              {b.branch.toUpperCase()}
            </h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {b.nodes.map((n) => {
                const base = BASELINE[n] ?? { level: "Exploring", pct: 15 };
                return (
                  <li
                    key={n}
                    className="card-hover rounded-lg border os-hud-line p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display font-bold text-white">
                        [{n}]
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
                        {base.level}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full rounded-full ${b.bar}`}
                        style={{ width: `${base.pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400">
                      Demanded in {byName[n] ?? 0} mission
                      {(byName[n] ?? 0) === 1 ? "" : "s"}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        </Reveal>
      ))}
      <Reveal>
        <DsaLogger total={(solves ?? []).length} recent={(solves ?? []) as { title: string | null; topic: string; difficulty: string; verdict: string | null; solved_at: string }[]} />
      </Reveal>
    </div>
  );
}
