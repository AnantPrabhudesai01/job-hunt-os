"use client";

import { useState } from "react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui";
import { liMessageFor, liNoteFor } from "@/lib/outreach-copy";

export type HrRow = {
  id: number;
  profile_url: string;
  person_name: string | null;
  role_title: string | null;
  company_name: string | null;
  email: string | null;
  connect_note: string | null;
  message_draft: string | null;
  status: "SAVED" | "VISITED" | "NOTE_SENT" | "CONNECTED" | "MESSAGED" | "REPLIED";
  mission_job_id: number | null;
  created_at: string;
};

const STATUSES = ["SAVED", "VISITED", "NOTE_SENT", "CONNECTED", "MESSAGED", "REPLIED"] as const;

const STATUS_STYLE: Record<string, string> = {
  SAVED: "border-zinc-500/40 text-zinc-300",
  VISITED: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  NOTE_SENT: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  CONNECTED: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  MESSAGED: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  REPLIED: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
};

/** One pasted line: URL only, or URL | Name | Role | Company | email */
function parseLine(line: string) {
  const parts = line.split("|").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0 || !parts[0].toLowerCase().includes("linkedin.com")) return null;
  const [url, name, role, company, email] = parts;
  return { url, name, role, company, email };
}

// Person-level notes have no JD attached, so tailoring = name + company.
// requiredSkills stays null on purpose: cleaner than guessing from a job title.
function draftNoteFor(r: HrRow) {
  return liNoteFor({
    first: (r.person_name ?? "there").split(" ")[0],
    role: "entry-level roles",
    company: r.company_name ?? "",
    requiredSkills: null,
  });
}

function draftMessageFor(r: HrRow) {
  return liMessageFor({
    first: (r.person_name ?? "there").split(" ")[0],
    role: "entry-level roles",
    company: r.company_name ?? "",
    requiredSkills: null,
  });
}

export function OutreachClient({ initial }: { initial: HrRow[] }) {
  const [rows, setRows] = useState<HrRow[]>(initial);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<number, { note: string; msg: string; job: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function refresh() {
    const j = await fetch("/api/outreach/import").then((r) => r.json());
    setRows((j.rows ?? []) as HrRow[]);
  }

  async function importPaste() {
    const items = paste.split("\n").map(parseLine).filter((x) => x !== null);
    if (items.length === 0) {
      setNote("Paste LinkedIn profile links first — one per line (URL only, or URL | Name | Role | Company | email).");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/outreach/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const j = await res.json();
      if (!res.ok) {
        setNote("Could not save. Try again.");
        return;
      }
      await refresh();
      setPaste("");
      setNote(
        `${j.added} new, ${j.duplicates} already visited${j.invalid ? `, ${j.invalid} not profile links` : ""}. Newest on top.`,
      );
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    const res = await fetch("/api/outreach/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    if (res.ok) await refresh();
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const counts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
  const shown = rows.filter((r) => {
    if (!q.trim()) return true;
    const hay = `${r.person_name ?? ""} ${r.role_title ?? ""} ${r.company_name ?? ""} ${r.email ?? ""}`.toLowerCase();
    return q.trim().toLowerCase().split(/\s+/).every((t) => hay.includes(t));
  });

  const ed = (id: number) => editing[id] ?? { note: "", msg: "", job: "" };
  const setEd = (id: number, v: { note: string; msg: string; job: string }) =>
    setEditing((prev) => ({ ...prev, [id]: v }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {STATUSES.map((s) => (
          <div key={s} className="rounded-lg border os-hud-line p-2">
            <p className="font-display text-lg font-bold text-white">{counts[s] ?? 0}</p>
            <p className="text-[10px] tracking-widest text-zinc-500">{s.replace("_", " ")}</p>
          </div>
        ))}
      </div>

      <section className="os-panel p-5">
        <SectionTitle kicker="BULK INTAKE" title="Paste 50–100 profiles" />
        <p className="mt-1 text-xs text-zinc-400">
          One per line: profile URL alone, or <span className="font-mono">URL | Name | Role | Company | email</span>.
          Repeats — inside the paste or already saved — are reported, never stored twice.
        </p>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"https://www.linkedin.com/in/some-recruiter\nhttps://www.linkedin.com/in/another-hr | Priya Nair | TA Lead | FinEdge | priya@finedge.com"}
          rows={4}
          className="mt-2 w-full rounded-lg border os-hud-line bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-zinc-600"
        />
        <button onClick={importPaste} disabled={busy} className="btn btn-primary mt-2 text-xs disabled:opacity-50">
          {busy ? "IMPORTING…" : "IMPORT PROFILES"}
        </button>
        {note && <p className="mt-2 text-xs text-amber-200">{note}</p>}
      </section>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter saved HR…"
        className="w-full rounded-lg border os-hud-line bg-black/30 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
      />

      <ul className="flex flex-col gap-3">
        {shown.map((r) => {
          const e = ed(r.id);
          const noteText = e.note || r.connect_note || "";
          const msgText = e.msg || r.message_draft || "";
          return (
            <li key={r.id} className="os-panel p-4">
              <div className="flex flex-wrap items-center gap-2">
                <a href={r.profile_url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-200 hover:text-white">
                  {r.person_name ?? "Unnamed HR"} ↗
                </a>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_STYLE[r.status]}`}>
                  {r.status.replace("_", " ")}
                </span>
                {r.mission_job_id && (
                  <Link href={`/missions/${r.mission_job_id}`} className="text-[11px] font-bold text-emerald-300">
                    MISSION #{r.mission_job_id} →
                  </Link>
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-400">
                {[r.role_title, r.company_name].filter(Boolean).join(" · ") || "Role/company unknown — edit after opening profile"}
                {r.email ? ` · ${r.email}` : ""}
              </p>
              <div className="mt-2 grid gap-2 lg:grid-cols-2">
                <div className="rounded-lg border os-hud-line p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold tracking-widest text-zinc-500">
                      CONNECT NOTE {noteText.length}/300
                    </p>
                    <div className="flex gap-1.5 text-[11px]">
                      <button onClick={() => setEd(r.id, { ...e, note: draftNoteFor(r) })} className="font-bold text-violet-300 hover:text-white">
                        DRAFT
                      </button>
                      <button onClick={() => copy(`n${r.id}`, noteText)} disabled={!noteText} className="font-bold text-zinc-300 hover:text-white disabled:opacity-40">
                        {copied === `n${r.id}` ? "COPIED" : "COPY"}
                      </button>
                      <button onClick={() => patch(r.id, { connect_note: noteText.slice(0, 300) })} disabled={!noteText} className="font-bold text-cyan-300 hover:text-white disabled:opacity-40">
                        SAVE
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={noteText}
                    onChange={(ev) => setEd(r.id, { ...e, note: ev.target.value.slice(0, 300) })}
                    placeholder="Your 300-char note… (DRAFT fills a starter from verified name/company)"
                    rows={2}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
                  />
                </div>
                <div className="rounded-lg border os-hud-line p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold tracking-widest text-zinc-500">FOLLOW-UP MESSAGE</p>
                    <div className="flex gap-1.5 text-[11px]">
                      <button onClick={() => setEd(r.id, { ...e, msg: draftMessageFor(r) })} className="font-bold text-violet-300 hover:text-white">
                        DRAFT
                      </button>
                      <button onClick={() => copy(`m${r.id}`, msgText)} disabled={!msgText} className="font-bold text-zinc-300 hover:text-white disabled:opacity-40">
                        {copied === `m${r.id}` ? "COPIED" : "COPY"}
                      </button>
                      <button onClick={() => patch(r.id, { message_draft: msgText })} disabled={!msgText} className="font-bold text-cyan-300 hover:text-white disabled:opacity-40">
                        SAVE
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={msgText}
                    onChange={(ev) => setEd(r.id, { ...e, msg: ev.target.value.slice(0, 2000) })}
                    placeholder="Message for after they accept…"
                    rows={2}
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                {(["VISITED", "NOTE_SENT", "CONNECTED", "MESSAGED", "REPLIED"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => patch(r.id, { status: s })}
                    className={`rounded border px-2 py-1 font-bold ${
                      r.status === s ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "os-hud-line text-zinc-400 hover:text-white"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
                <input
                  value={e.job}
                  onChange={(ev) => setEd(r.id, { ...e, job: ev.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="Mission #"
                  inputMode="numeric"
                  className="w-24 rounded border os-hud-line bg-black/30 px-2 py-1 text-[11px] text-white placeholder:text-zinc-600"
                />
                <button
                  onClick={() => e.job && patch(r.id, { mission_job_id: Number(e.job) })}
                  disabled={!e.job}
                  className="rounded border border-emerald-400/40 px-2 py-1 font-bold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-40"
                >
                  LINK
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && rows.length > 0 && (
        <p className="text-sm text-zinc-500">No saved HR matches that filter.</p>
      )}
    </div>
  );
}
