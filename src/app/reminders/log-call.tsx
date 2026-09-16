"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";

export type CallEntry = {
  id: number;
  name: string;
  phone: string;
  company: string;
  jobId: number;
  mission_id: string | null;
  title: string | null;
};

// Call-first logging: BOTH dropdowns come from verified numbers only.
// Picking a person fills their mission + number; picking a mission narrows
// to its people. Missions without numbers never appear here.
export function LogCall({ entries }: { entries: CallEntry[] }) {
  const router = useRouter();
  const [entryId, setEntryId] = useState("");
  const [jobId, setJobId] = useState("");
  const [contact, setContact] = useState("");
  const [outcome, setOutcome] = useState("");
  const [callback, setCallback] = useState("");
  const [interview, setInterview] = useState("");
  const [noAnswer, setNoAnswer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const F = "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";

  const byJob = new Map<number, CallEntry[]>();
  for (const e of entries) {
    const list = byJob.get(e.jobId) ?? [];
    list.push(e);
    byJob.set(e.jobId, list);
  }
  const missionOpts = [...byJob.entries()].map(([jid, list]) => ({
    jobId: jid,
    mission_id: list[0].mission_id,
    title: list[0].title,
    phones: [...new Set(list.map((e) => e.phone))].join(" / "),
  }));
  const peopleForJob = jobId ? (byJob.get(Number(jobId)) ?? entries) : entries;

  function pickPerson(id: string) {
    setEntryId(id);
    const e = entries.find((x) => String(x.id) === id);
    if (e) {
      setJobId(String(e.jobId));
      setContact(e.name);
    }
  }

  function pickMission(id: string) {
    setJobId(id);
    const list = id ? (byJob.get(Number(id)) ?? []) : [];
    if (list.length > 0) {
      setEntryId(String(list[0].id));
      setContact(list[0].name);
    } else {
      setEntryId("");
      setContact("");
    }
  }

  async function save() {
    if (!jobId || outcome.trim().length < 3) {
      setMsg("Pick who you spoke to (or the mission) and write what happened.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/calls/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: Number(jobId),
          contactName: contact.trim() || null,
          outcome: outcome.trim(),
          callbackDate: callback || null,
          interviewNote: interview.trim() || null,
          noAnswer,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg(
          `+${j.xp ?? 5} XP logged${j.autoRetry ? " · no answer — retry queued for tomorrow" : ""}${
            j.callbackQueued && j.callbackQueued !== "already-queued" && !j.autoRetry
              ? ` · callback reminder set for ${j.callbackQueued}`
              : j.callbackQueued === "already-queued"
                ? " · nudge already queued"
                : ""
          }.`,
        );
        setOutcome("");
        setCallback("");
        setInterview("");
        setNoAnswer(false);
        router.refresh();
      } else {
        setMsg(j.error ?? "Log failed.");
      }
    } catch {
      setMsg("Log failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (entries.length === 0) {
    return (
      <div className="os-panel p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Phone size={14} className="text-emerald-300" aria-hidden />
          Log a call outcome
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          No callable missions — numbers you share appear here with full context.
        </p>
      </div>
    );
  }

  return (
    <div className="os-panel p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
        <Phone size={14} className="text-emerald-300" aria-hidden />
        Log a call outcome
      </p>
      <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
        <select value={entryId} onChange={(e) => pickPerson(e.target.value)} aria-label="Who did you speak to" className={F}>
          <option value="">Who did you speak to…</option>
          {peopleForJob.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.phone} ({e.company})
            </option>
          ))}
        </select>
        <select value={jobId} onChange={(e) => pickMission(e.target.value)} aria-label="Mission" className={F}>
          <option value="">Which mission…</option>
          {missionOpts.map((m) => (
            <option key={m.jobId} value={m.jobId}>
              {m.mission_id} · {m.title} — {m.phones}
            </option>
          ))}
        </select>
        <textarea
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          placeholder="What happened — what they said, word for word as you remember"
          aria-label="Call outcome"
          rows={3}
          className={`${F} sm:col-span-2`}
        />
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          They said call back… (date)
          <input type="date" value={callback} onChange={(e) => setCallback(e.target.value)} aria-label="Callback date" className={F} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Interview scheduled? (day + time + where)
          <input value={interview} onChange={(e) => setInterview(e.target.value)} placeholder="e.g. Tue 11am, video link" aria-label="Interview appointment" className={F} />
        </label>
      </div>
      {msg && (
        <p className="mt-2 text-sm text-cyan-200" role="status" aria-live="polite">
          {msg}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={noAnswer}
            onChange={(e) => setNoAnswer(e.target.checked)}
            className="h-4 w-4 accent-orange-400"
          />
          Not answered — auto-retry tomorrow
        </label>
        <button onClick={() => void save()} disabled={busy} className="btn btn-primary text-sm disabled:opacity-40">
          {busy ? "Logging…" : "LOG CALL"}
        </button>
      </div>
    </div>
  );
}
