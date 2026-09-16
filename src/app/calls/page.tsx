import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { LogCall } from "../reminders/log-call";

// Calls, dedicated: every verified number with full context, the call-back
// reminders due, and the outcome log. You dial — everything else is managed.
export default async function CallsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: contacts }, { data: jobs }, { data: hist }, { data: nudges }] = await Promise.all([
    supabase.from("contacts").select("id,name,role_title,phone,companies(id,name)").not("phone", "is", null),
    supabase.from("jobs").select("id,mission_id,title,status,company_id,applications(stage)").not("status", "in", "(REJECTED,WITHDRAWN,CLOSED)"),
    supabase.from("communications").select("job_id,created_at").eq("channel", "PHONE"),
    supabase
      .from("follow_ups")
      .select("id,due_date,contact_name,notes,job_id,jobs(mission_id,title,companies(name))")
      .eq("status", "PENDING")
      .in("channel", ["PHONE", "WHATSAPP"])
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const lastCallByJob = new Map<number, string>();
  for (const h of hist ?? []) {
    if (h.job_id != null && !lastCallByJob.has(h.job_id)) lastCallByJob.set(h.job_id, String(h.created_at).slice(0, 10));
  }
  const numbers = (contacts ?? [])
    .map((c) => {
      const co = one(c.companies);
      const job = (jobs ?? []).find((j) => j.company_id === co?.id) ?? null;
      const app = job ? one(job.applications) : null;
      return {
        id: c.id,
        name: c.name,
        role: c.role_title,
        phone: c.phone as string,
        company: co?.name ?? "",
        mission: job?.mission_id ?? null,
        jobId: job?.id ?? null,
        title: job?.title ?? null,
        stage: app?.stage ?? job?.status ?? null,
        lastCall: job && lastCallByJob.has(job.id) ? lastCallByJob.get(job.id)! : null,
      };
    })
    .filter((n) => n.jobId !== null);

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="DIAL ROOM" title={`Numbers to call (${numbers.length})`} />
        {numbers.length === 0 ? (
          <p className="text-sm text-zinc-500">No verified mobiles on live missions yet.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {numbers.map((n) => (
              <li key={n.id} className="os-panel p-3 text-sm">
                <p className="font-semibold text-white">
                  {n.name} <span className="font-normal text-zinc-400">· {n.role ?? "role unknown"}</span>
                </p>
                <a href={`tel:${n.phone.replace(/\D/g, "")}`} className="font-mono text-lg font-bold text-emerald-300">
                  {n.phone}
                </a>
                <p className="mt-1 text-xs text-zinc-400">
                  {n.company} · {n.mission} {n.title} · {n.stage ?? ""}
                </p>
                <p className="text-xs text-cyan-200">
                  {n.lastCall ? `Last called ${n.lastCall} — log the outcome below` : "Never dialed — call first, then log"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Reveal>
      <Reveal>
        <SectionTitle kicker="CALL BACKS" title={`Call reminders (${(nudges ?? []).length})`} />
        {!nudges || nudges.length === 0 ? (
          <p className="text-sm text-zinc-500">No call reminders due. No-answers and promised callbacks land here automatically.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {nudges.map((f) => {
              const job = one(f.jobs);
              const co = one(job?.companies ?? null);
              return (
                <li key={f.id} className="os-panel flex flex-wrap items-center gap-2 p-3 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-white">
                      {job?.mission_id} · {job?.title ?? "Mission"}
                    </span>
                    <span className="block truncate text-xs text-zinc-400">
                      {co?.name ?? ""}{f.contact_name ? ` · ${f.contact_name}` : ""} · due {f.due_date ?? "unscheduled"}
                      {f.notes ? ` · ${f.notes.slice(0, 100)}` : ""}
                    </span>
                  </span>
                  <Link href="/quests" className="rounded-md border os-hud-line px-2.5 py-1 text-xs text-cyan-200">
                    Open in queue →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
      <Reveal>
        <LogCall entries={numbers.map((n) => ({ id: n.id, name: n.name, phone: n.phone, company: n.company, jobId: n.jobId, mission_id: n.mission, title: n.title }))} />
      </Reveal>
    </div>
  );
}
