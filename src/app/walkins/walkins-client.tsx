"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, CalendarClock, Star, Check } from "lucide-react";
import { SectionTitle } from "@/components/ui";

type Mission = {
  id: number;
  mission_id: string | null;
  title: string;
  location: string | null;
  deadline: string | null;
  employment_type: string | null;
  companies: { name?: string } | null;
};

type Report = {
  mission_job_id: number;
  attended: boolean;
  visited_date: string | null;
  rounds: string | null;
  questions_asked: string | null;
  crowd_notes: string | null;
  outcome: string;
  rating: number | null;
  notes: string | null;
};

const OUTCOMES = ["UPCOMING", "ATTENDED", "SHORTLISTED", "REJECTED", "WAITING", "SKIPPED"] as const;

const OUTCOME_STYLE: Record<string, string> = {
  UPCOMING: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  ATTENDED: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  SHORTLISTED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  REJECTED: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  WAITING: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  SKIPPED: "border-zinc-500/40 text-zinc-400",
};

function dayCount(deadline: string | null): number | null {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

function countdownLabel(days: number | null): { text: string; cls: string } {
  if (days === null) return { text: "DATE IN POST", cls: "os-hud-line text-zinc-400" };
  if (days < 0) return { text: "PASSED", cls: "border-zinc-500/40 text-zinc-500" };
  if (days === 0) return { text: "TODAY", cls: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" };
  if (days <= 3) return { text: `IN ${days}d — GET READY`, cls: "border-yellow-300/50 bg-yellow-300/10 text-yellow-200" };
  return { text: `IN ${days}d`, cls: "border-sky-400/40 bg-sky-400/10 text-sky-200" };
}

function gcalUrl(m: Mission): string {
  // All-day event on the walk-in date (times vary per poster — details say so).
  // Google template links can't set reminders; your calendar's own default
  // alert applies, and the app bell nags daily from 3 days out.
  const d = (m.deadline ?? "").slice(0, 10).replace(/-/g, "");
  const next = d ? String(Number(d) + 1) : "";
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `Walk-in: ${m.title} @ ${m.companies?.name ?? ""}`,
    dates: d ? `${d}/${next}` : "",
    details: `Walk-in drive — ${(m.mission_id ?? "")} ${m.title} @ ${m.companies?.name ?? ""}, ${m.location ?? "venue in post"}. Confirm exact time from the poster. Carry resume + ID.`,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

function downloadIcs(m: Mission) {
  const d = (m.deadline ?? "").slice(0, 10).replace(/-/g, "");
  if (!d) return;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JobHuntOS//Walkins//EN", "BEGIN:VEVENT",
    `UID:walkin-${m.id}@jobhuntos`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${String(Number(d) + 1)}`,
    `SUMMARY:Walk-in: ${m.title} @ ${m.companies?.name ?? ""}`,
    `DESCRIPTION:${(m.mission_id ?? "")} ${(m.title)} @ ${(m.companies?.name ?? "")}, ${(m.location ?? "venue in post")}. Confirm exact time from the poster. Carry resume + ID.`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Walk-in tomorrow", "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-PT12H", "ACTION:DISPLAY", "DESCRIPTION:Walk-in today", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `walkin-${m.mission_id ?? m.id}.ics`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const F =
  "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";

function Editor({ m, existing, onSaved }: { m: Mission; existing?: Report; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [f, setF] = useState({
    attended: existing?.attended ?? false,
    visited_date: existing?.visited_date ?? "",
    rounds: existing?.rounds ?? "",
    questions_asked: existing?.questions_asked ?? "",
    crowd_notes: existing?.crowd_notes ?? "",
    outcome: existing?.outcome ?? "UPCOMING",
    rating: existing?.rating ? String(existing.rating) : "",
    notes: existing?.notes ?? "",
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setBusy(true);
    const res = await fetch("/api/walkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission_job_id: m.id,
        attended: f.attended,
        visited_date: f.visited_date || null,
        rounds: f.rounds || null,
        questions_asked: f.questions_asked || null,
        crowd_notes: f.crowd_notes || null,
        outcome: f.outcome,
        rating: f.rating ? Number(f.rating) : null,
        notes: f.notes || null,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onSaved();
    }
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="btn btn-ghost text-xs" aria-expanded={open}>
        {existing ? "EDIT FIELD REPORT" : "+ LOG WALK-IN REPORT"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input type="checkbox" checked={f.attended} onChange={(e) => set("attended", e.target.checked)} />
            I went to this walk-in
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">VISITED DATE
              <input type="date" value={f.visited_date} onChange={(e) => set("visited_date", e.target.value)} className={F} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">OUTCOME
              <select value={f.outcome} onChange={(e) => set("outcome", e.target.value)} className={F}>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">ROUNDS FACED (e.g. Aptitude, Technical, HR)
            <input value={f.rounds} onChange={(e) => set("rounds", e.target.value)} className={F} placeholder="What stages happened?" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">QUESTIONS THEY ASKED
            <textarea value={f.questions_asked} onChange={(e) => set("questions_asked", e.target.value)} rows={3} className={`${F} font-mono text-[13px]`} placeholder="As many as you remember, word for word" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">CROWD / WAIT / LOGISTICS
            <input value={f.crowd_notes} onChange={(e) => set("crowd_notes", e.target.value)} className={F} placeholder="Rush, tokens, waiting hours…" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-zinc-400">RATING (1–5)
              <select value={f.rating} onChange={(e) => set("rating", e.target.value)} className={F}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">YOUR EXPERIENCE (free notes)
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={`${F} text-[13px]`} placeholder="What happened there, in your words" />
          </label>
          <button onClick={save} disabled={busy} className="btn btn-primary self-start text-xs disabled:opacity-40">
            {busy ? "SAVING…" : saved ? "✓ SAVED" : "SAVE REPORT"}
          </button>
          <p className="text-[11px] text-zinc-500">Notes only — saving never changes application status.</p>
        </div>
      )}
    </div>
  );
}

export function WalkinsClient({ missions, reports: initial }: { missions: Mission[]; reports: Report[] }) {
  const [reports, setReports] = useState(initial);

  async function refresh() {
    const j = await fetch("/api/walkins").then((r) => r.json());
    setReports((j.reports ?? []) as Report[]);
  }

  const byMission = new Map(reports.map((r) => [r.mission_job_id, r]));
  const reported = reports.length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-zinc-500" aria-live="polite">
        {missions.length} walk-in mission(s) · {reported} field report(s) filed
      </p>
      {missions.length === 0 && (
        <p className="rounded-xl border border-dashed border-violet-400/20 p-6 text-center text-sm text-zinc-500">
          No walk-in missions detected yet. They appear here automatically when a posting mentions a walk-in.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {missions.map((m) => {
          const r = byMission.get(m.id);
          const cd = countdownLabel(dayCount(m.deadline));
          return (
            <li key={m.id} className="os-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-[11px] font-bold tracking-[0.2em] text-amber-300">
                    {m.mission_id ?? `Mission ${m.id}`}
                  </p>
                  <p className="truncate text-sm font-bold text-white">
                    {m.title} · {m.companies?.name ?? ""}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                    {m.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} aria-hidden /> {m.location}
                      </span>
                    )}
                    {m.deadline && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock size={12} aria-hidden /> {m.deadline}
                      </span>
                    )}
                    <Link href={`/missions/${m.id}`} className="text-cyan-300">
                      Open mission ↗
                    </Link>
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${cd.cls}`}>
                      🚶 {cd.text}
                    </span>
                    {m.deadline && (
                      <>
                        <a href={gcalUrl(m)} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-bold text-zinc-300 hover:bg-white/5">
                          + GOOGLE CALENDAR
                        </a>
                        <button onClick={() => downloadIcs(m)} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-bold text-zinc-300 hover:bg-white/5">
                          ↓ .ICS FILE
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {r && (
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${OUTCOME_STYLE[r.outcome] ?? OUTCOME_STYLE.UPCOMING}`}>
                    {r.outcome.replace("_", " ")}
                    {r.rating ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Star size={11} aria-hidden /> {r.rating}
                      </span>
                    ) : null}
                  </span>
                )}
              </div>
              {r && (r.rounds || r.questions_asked || r.notes) && (
                <div className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2.5 text-xs text-zinc-300">
                  {r.rounds && <p><strong className="text-zinc-100">Rounds:</strong> {r.rounds}</p>}
                  {r.questions_asked && <p className="mt-1 whitespace-pre-wrap"><strong className="text-zinc-100">They asked:</strong> {r.questions_asked}</p>}
                  {r.crowd_notes && <p className="mt-1"><strong className="text-zinc-100">Logistics:</strong> {r.crowd_notes}</p>}
                  {r.notes && <p className="mt-1 whitespace-pre-wrap"><strong className="text-zinc-100">Experience:</strong> {r.notes}</p>}
                </div>
              )}
              {r && !r.rounds && !r.questions_asked && !r.notes && (
                <p className="mt-2 flex items-center gap-1 text-xs text-emerald-200">
                  <Check size={12} aria-hidden /> Report filed — open it to add rounds & questions.
                </p>
              )}
              <Editor m={m} existing={r} onSaved={refresh} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
