import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { LogCall } from "./log-call";

// Reminders hub: every pending nudge grouped by channel (Call / Mail /
// LinkedIn), plus live interview fronts. Acting happens in the Nudge Queue;
// this is the see-everything board.
const GROUPS: { key: string; title: string; channels: string[] }[] = [
  { key: "call", title: "Call backs", channels: ["PHONE", "WHATSAPP"] },
  { key: "mail", title: "Mail follow-ups", channels: ["EMAIL"] },
  { key: "li", title: "LinkedIn follow-ups", channels: ["LINKEDIN"] },
];

export default async function RemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: follows }, { data: calls }, { data: live }, { data: callables }, { data: callHist }] =
    await Promise.all([
      supabase
        .from("follow_ups")
        .select("id,due_date,channel,contact_name,notes,job_id,jobs(mission_id,title,companies(name))")
        .eq("status", "PENDING")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("communications")
        // call outcomes live in `body` (there is no `notes` column).
        .select("id,body,created_at,jobs(mission_id,title)")
        .eq("channel", "PHONE")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("jobs")
        .select("id,mission_id,title,companies(name)")
        .in("status", ["INTERVIEW", "ASSESSMENT", "FINAL ROUND"]),
      // Numbers to call: verified mobiles on live (non-terminal) missions.
      supabase
        .from("contacts")
        .select("id,name,role_title,phone,companies(id,name)")
        .not("phone", "is", null),
      supabase.from("communications").select("job_id,created_at").eq("channel", "PHONE"),
    ]);

  // Attach each number to its company's most recent live mission + call state.
  const { data: activeJobs } = await supabase
    .from("jobs")
    .select("id,mission_id,title,status,company_id,applications(stage)")
    .not("status", "in", "(REJECTED,WITHDRAWN,CLOSED)");
  const lastCallByJob = new Map<number, string>();
  for (const h of callHist ?? []) {
    if (h.job_id != null && !lastCallByJob.has(h.job_id)) lastCallByJob.set(h.job_id, String(h.created_at).slice(0, 10));
  }
  const numbers = (callables ?? [])
    .map((c) => {
      const co = Array.isArray(c.companies) ? c.companies[0] : c.companies;
      const job = (activeJobs ?? []).find((j) => j.company_id === co?.id) ?? null;
      const stage = job
        ? ((Array.isArray(job.applications) ? job.applications[0] : job.applications)?.stage ?? job.status)
        : null;
      return {
        id: c.id,
        name: c.name,
        role: c.role_title,
        phone: c.phone as string,
        company: co?.name ?? "",
        mission: job?.mission_id ?? null,
        jobId: job?.id ?? null,
        title: job?.title ?? null,
        stage,
        lastCall: job && lastCallByJob.has(job.id) ? lastCallByJob.get(job.id)! : null,
      };
    })
    .filter((n) => n.jobId !== null);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const rows = (follows ?? []).map((f) => ({ ...f, job: one(f.jobs) }));

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="MEMORY" title="Reminders — every open loop" />
        <LogCall entries={numbers.map((n) => ({ id: n.id, name: n.name, phone: n.phone, company: n.company, jobId: n.jobId, mission_id: n.mission, title: n.title }))} />
      </Reveal>
      <Reveal>
        <SectionTitle kicker="DIAL LIST" title={`Numbers to call (${numbers.length})`} />
        {numbers.length === 0 ? (
          <p className="text-sm text-zinc-500">No verified mobiles on live missions. Numbers you share appear here with full context.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {numbers.map((n) => (
              <li key={n.id} className="os-panel p-3 text-sm">
                <p className="font-semibold text-white">
                  {n.name} <span className="font-normal text-zinc-400">· {n.role ?? "role unknown"}</span>
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2">
                  <a href={`tel:${n.phone.replace(/\D/g, "")}`} className="font-mono text-base font-bold text-emerald-300">
                    {n.phone}
                  </a>
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {n.company} · {n.mission} {n.title} · {n.stage ?? ""}
                </p>
                <p className="text-xs text-cyan-200">
                  {n.lastCall ? `Last called ${n.lastCall} — log the outcome below after redialing` : "Never dialed — call first, then log what happened"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      {GROUPS.map((g) => {
        const items = rows.filter((f) => g.channels.includes((f.channel ?? "EMAIL").toUpperCase()));
        return (
          <Reveal key={g.key}>
            <SectionTitle kicker="CHANNEL" title={`${g.title} (${items.length})`} />
            {items.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing waiting here.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((f) => (
                  <li key={f.id} className="os-panel flex flex-wrap items-center gap-2 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <Link href={f.job_id ? `/missions/${f.job_id}` : "/quests"} className="font-semibold text-white">
                        {f.job?.mission_id} · {f.job?.title ?? "Mission"}
                      </Link>
                      <span className="block truncate text-xs text-zinc-400">
                        {f.contact_name ? `${f.contact_name} · ` : ""}due {f.due_date ?? "unscheduled"}
                        {f.notes ? ` · ${f.notes.slice(0, 90)}` : ""}
                      </span>
                    </span>
                    <Link href="/quests" className="rounded-md border os-hud-line px-2.5 py-1 text-xs text-cyan-200">
                      Act in queue →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        );
      })}
      <Reveal>
        <SectionTitle kicker="FRONTS" title={`Live interviews (${(live ?? []).length})`} />
        {!live || live.length === 0 ? (
          <p className="text-sm text-zinc-500">No live battles. Interview dates you share appear here with countdowns.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {live.map((b) => (
              <li key={b.id} className="os-panel border-red-400/40 p-3 text-sm">
                <Link href={`/missions/${b.id}`} className="font-semibold text-white">
                  {b.mission_id} · {b.title}
                </Link>
                <span className="block text-xs text-zinc-400">
                  {(one(b.companies as { name?: string } | { name?: string }[] | null))?.name ?? ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal>
        <SectionTitle kicker="TAPE" title="Recent call outcomes" />
        {!calls || calls.length === 0 ? (
          <p className="text-sm text-zinc-500">No calls logged yet. Outcomes you paste land here verbatim.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {calls.map((c) => {
              const job = one(c.jobs);
              return (
                <li key={c.id} className="os-panel p-3 text-sm">
                  <p className="text-zinc-100">{c.body}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {job?.mission_id} · {job?.title} · {String(c.created_at).slice(0, 10)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
