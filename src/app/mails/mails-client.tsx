"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Mail, Copy, Check, ExternalLink, ChevronDown } from "lucide-react";

type Draft = {
  id: number;
  to_email: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  jobs: { id: number; title: string; mission_id: string | null; companies: { id: number; name: string } | null } | null;
  nudge: { due: string | null; channel: string } | null;
};

// Read-only mail store. Drafts are written at intake time only (DRAFTED);
// sending happens in your mailbox and never flips anything here (SENT≠APPLIED).
export function MailsClient({ drafts }: { drafts: Draft[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [openId, setOpenId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const statuses = useMemo(
    () => ["ALL", ...Array.from(new Set(drafts.map((d) => d.status ?? "DRAFTED")))],
    [drafts],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return drafts.filter((d) => {
      if (status !== "ALL" && (d.status ?? "DRAFTED") !== status) return false;
      if (!needle) return true;
      const hay = `${d.to_email} ${d.subject} ${d.body} ${d.jobs?.companies?.name ?? ""} ${d.jobs?.title ?? ""}`.toLowerCase();
      return needle.split(/\s+/).every((t) => hay.includes(t));
    });
  }, [drafts, q, status]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable — selection still works */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search mails — company, to, subject, body…"
            aria-label="Search mails"
            className="w-full rounded-lg border border-violet-400/20 bg-[#0d1428] py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-400/50 focus:outline-none"
          />
        </label>
        <div className="flex gap-1.5" role="group" aria-label="Filter by status">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                status === s
                  ? "bg-cyan-400/15 text-cyan-200"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-zinc-500" aria-live="polite">
        {rows.length} of {drafts.length} mail(s) · drafts only — sending stays a manual mailbox action
      </p>

      <ul className="flex flex-col gap-2.5">
        {rows.map((d) => {
          const open = openId === d.id;
          const company = d.jobs?.companies?.name ?? "—";
          return (
            <li
              key={d.id}
              className="rounded-xl border border-violet-400/15 bg-[#0d1428]/80 p-3.5"
            >
              <button
                onClick={() => setOpenId(open ? null : d.id)}
                aria-expanded={open}
                className="flex w-full items-start gap-3 text-left"
              >
                <span className="mt-0.5 rounded-md bg-cyan-400/10 p-1.5 text-cyan-300" aria-hidden>
                  <Mail size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">
                    {d.subject}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-zinc-400">
                    To {d.to_email} · {company}
                    {d.jobs?.title ? ` · ${d.jobs.title}` : ""}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${
                    (d.status ?? "DRAFTED") === "DRAFTED"
                      ? "bg-amber-400/10 text-amber-200"
                      : "bg-emerald-400/10 text-emerald-200"
                  }`}
                >
                  {d.status ?? "DRAFTED"}
                </span>
                {d.nudge && (
                  <span
                    title={`Follow-up queued (${d.nudge.channel}) — act in the Nudge Queue`}
                    className="shrink-0 rounded-md border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[11px] font-bold text-violet-200"
                  >
                    NUDGE{d.nudge.due ? ` ${d.nudge.due}` : ""}
                  </span>
                )}
                <ChevronDown
                  size={15}
                  aria-hidden
                  className={`mt-1 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-xs leading-relaxed text-zinc-200">
                    {d.body}
                  </pre>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => void copy(d.body, `b${d.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/25 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
                    >
                      {copied === `b${d.id}` ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                      {copied === `b${d.id}` ? "COPIED" : "COPY MAIL"}
                    </button>
                    <button
                      onClick={() => void copy(d.to_email, `e${d.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5"
                    >
                      {copied === `e${d.id}` ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                      {copied === `e${d.id}` ? "COPIED" : "COPY EMAIL"}
                    </button>
                    {d.jobs && (
                      <Link
                        href={`/missions/${d.jobs.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5"
                      >
                        <ExternalLink size={13} aria-hidden />
                        {d.jobs.mission_id ?? `Mission ${d.jobs.id}`}
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-violet-400/20 p-6 text-center text-sm text-zinc-500">
          No mails match. New drafts appear here automatically when a job or mail is ingested.
        </p>
      )}
    </div>
  );
}
