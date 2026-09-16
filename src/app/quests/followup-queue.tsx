"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, Send } from "lucide-react";
import {
  followupMessage,
  isOverdue,
  suggestDate,
  todayKey,
  type Channel,
} from "@/lib/followups";
import type { OriginalMail } from "./followup-queue-server";

export type SuggestedNudge = {
  jobId: number;
  missionId: string | null;
  title: string;
  company: string;
  stage: string;
  daysWaiting: number;
  contactName: string | null;
};

export type QueuedFollowup = {
  id: number;
  jobId: number | null;
  missionId: string | null;
  title: string;
  company: string;
  contactName: string | null;
  channel: Channel;
  dueDate: string | null;
  daysWaiting: number;
  originalMail: OriginalMail;
  gmailUrl: string | null;
  resumeFile: string | null;
};

// The follow-up queue. COPY ALL for manual sends; SEND (Gmail) fires the
// approved-send API with your explicit two-tap confirm — no passwords ever,
// OAuth token only, wrong-resume BLOCK and SENT≠APPLIED intact.
export function FollowupQueue({
  suggested,
  scheduled,
  gmailConnected,
}: {
  suggested: SuggestedNudge[];
  scheduled: QueuedFollowup[];
  gmailConnected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [channelFor, setChannelFor] = useState<Record<number, Channel>>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);

  async function schedule(s: SuggestedNudge) {
    const channel = channelFor[s.jobId] ?? "EMAIL";
    setBusy(`s${s.jobId}`);
    setMsg(null);
    try {
      const res = await fetch("/api/followups/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: s.jobId,
          contactName: s.contactName,
          channel,
          dueDate: suggestDate(todayKey()),
        }),
      });
      const j = await res.json();
      setMsg(j.ok ? `Nudge queued for ${s.missionId ?? s.title}.` : (j.error ?? "Schedule failed."));
      router.refresh();
    } catch {
      setMsg("Schedule failed — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function markSent(id: number) {
    setBusy(`m${id}`);
    setMsg(null);
    try {
      const res = await fetch("/api/followups/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirmedSent: true }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg(`+${j.xp ?? 10} XP — follow-up logged as sent.`);
        setConfirmId(null);
        router.refresh();
      } else {
        setMsg(j.error ?? "Confirm failed.");
      }
    } catch {
      setMsg("Confirm failed — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* selection fallback */
    }
  }

  const [sendId, setSendId] = useState<number | null>(null);

  async function sendGmail(f: QueuedFollowup, text: string) {
    if (!f.jobId || !f.originalMail || !f.resumeFile) return;
    setBusy(`g${f.id}`);
    setMsg(null);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: f.jobId,
          to: f.originalMail.to,
          subject: `Re: ${f.originalMail.subject}`,
          body: text,
          resumeFileName: f.resumeFile,
          confirmed: true,
        }),
      });
      const j = await res.json();
      if (j.ok) {
        // Gmail-confirmed send IS the confirmation — close the nudge too.
        await fetch("/api/followups/sent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: f.id, confirmedSent: true }),
        });
        setMsg(`Sent via Gmail (${j.messageId ?? "ok"}) + nudge closed. Status untouched — SENT≠APPLIED.`);
        setSendId(null);
        router.refresh();
      } else {
        setMsg(j.error ?? "Gmail send failed.");
      }
    } catch {
      setMsg("Gmail send failed — try again.");
    } finally {
      setBusy(null);
    }
  }

  const channels: Channel[] = ["EMAIL", "WHATSAPP", "LINKEDIN", "PHONE"];

  return (
    <div className="flex flex-col gap-3">
      {msg && (
        <p className="text-sm text-cyan-200" role="status" aria-live="polite">
          {msg}
        </p>
      )}

      {scheduled.length > 0 && (
        <>
          <p className="text-xs font-bold tracking-widest text-zinc-500">QUEUED ({scheduled.length})</p>
          <ul className="flex flex-col gap-2">
            {scheduled.map((f) => {
              const overdue = isOverdue(f.dueDate);
              const text = followupMessage(f.channel, f.company, f.title, f.contactName, f.daysWaiting);
              return (
                <li
                  key={f.id}
                  className={`os-panel p-3 ${overdue ? "border-orange-400/40" : ""}`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1 font-semibold text-white">
                      {f.missionId} · {f.title}
                    </span>
                    <span className="rounded border os-hud-line px-1.5 py-px text-[10px] text-zinc-300">
                      {f.channel}
                    </span>
                    <span className={`text-[11px] font-bold ${overdue ? "text-orange-300" : "text-zinc-500"}`}>
                      {overdue ? `OVERDUE (due ${f.dueDate})` : f.dueDate ? `due ${f.dueDate}` : "unscheduled"}
                    </span>
                  </div>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2.5 text-xs leading-relaxed text-zinc-200">
                    {text}
                  </pre>
                  {f.originalMail && (
                    <div className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2.5 text-xs">
                      <p className="text-[10px] tracking-widest text-zinc-500">ORIGINAL MAIL — reply in this thread</p>
                      <p className="mt-1 truncate text-zinc-200" title={f.originalMail.subject}>
                        {f.originalMail.subject}
                      </p>
                      <p className="text-zinc-500">
                        → {f.originalMail.to}
                        {f.originalMail.at ? ` · ${f.originalMail.at}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <button
                          onClick={() => void copy(f.originalMail!.subject, `s${f.id}`)}
                          className="inline-flex items-center gap-1 rounded-md border os-hud-line px-2 py-0.5 text-[11px] text-zinc-300 hover:bg-white/5"
                        >
                          {copied === `s${f.id}` ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                          {copied === `s${f.id}` ? "COPIED" : "COPY SUBJECT (Gmail search)"}
                        </button>
                        {f.gmailUrl ? (
                          <a
                            href={f.gmailUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-cyan-400/25 px-2 py-0.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-400/10"
                          >
                            OPEN MAIL ↗
                          </a>
                        ) : (
                          <span className="self-center text-[11px] text-zinc-600">
                            Paste the Gmail link in chat to attach it here
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        void copy(
                          `To: ${f.originalMail?.to ?? f.contactName ?? ""}\nSubject: Re: ${f.originalMail?.subject ?? `${f.title} application (${f.company})`}\n\n${text}`,
                          `a${f.id}`,
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-100 hover:bg-cyan-400/20"
                    >
                      {copied === `a${f.id}` ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                      {copied === `a${f.id}` ? "COPIED" : "COPY ALL (to + subject + message)"}
                    </button>
                    <button
                      onClick={() => void copy(text, `q${f.id}`)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400/25 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
                    >
                      {copied === `q${f.id}` ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                      {copied === `q${f.id}` ? "COPIED" : "COPY MESSAGE"}
                    </button>
                    {confirmId === f.id ? (
                      <>
                        <span className="self-center text-xs text-zinc-400">You sent it yourself?</span>
                        <button
                          onClick={() => void markSent(f.id)}
                          disabled={busy === `m${f.id}`}
                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold hover:bg-emerald-500"
                        >
                          YES, I SENT IT
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-md border os-hud-line px-2.5 py-1 text-xs text-zinc-400"
                        >
                          Not yet
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmId(f.id)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/25 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/10"
                      >
                        <Send size={13} aria-hidden />I SENT IT
                      </button>
                    )}
                    {f.jobId && (
                      <Link
                        href={`/missions/${f.jobId}`}
                        className="rounded-md border os-hud-line px-2.5 py-1 text-xs text-zinc-300 hover:text-white"
                      >
                        Open mission
                      </Link>
                    )}
                    {f.originalMail && f.resumeFile ? (
                      sendId === f.id ? (
                        <>
                          <span className="self-center text-xs text-zinc-400">
                            Send to {f.originalMail.to} with {f.resumeFile}?
                          </span>
                          <button
                            onClick={() => void sendGmail(f, text)}
                            disabled={busy === `g${f.id}`}
                            className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-bold hover:bg-sky-500"
                          >
                            {busy === `g${f.id}` ? "SENDING…" : "YES, SEND"}
                          </button>
                          <button
                            onClick={() => setSendId(null)}
                            className="rounded-md border os-hud-line px-2.5 py-1 text-xs text-zinc-400"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => (gmailConnected ? setSendId(f.id) : setMsg("Connect Gmail first (mission Outreach → CONNECT GMAIL) — no password ever needed."))}
                          className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-xs font-bold text-sky-200 hover:bg-sky-400/20"
                        >
                          <Send size={13} aria-hidden /> SEND (Gmail)
                        </button>
                      )
                    ) : (
                      <span className="self-center text-[11px] text-zinc-600" title="Needs the original mail + mission resume on file">
                        Gmail send unavailable (no mail/resume on file)
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {suggested.length > 0 && (
        <>
          <p className="text-xs font-bold tracking-widest text-zinc-500">
            SUGGESTED ({suggested.length}) — waiting 4+ days, no nudge queued
          </p>
          <ul className="flex flex-col gap-2">
            {suggested.map((s) => (
              <li key={s.jobId} className="os-panel flex flex-wrap items-center gap-2 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-white">
                    {s.missionId} · {s.title}
                  </span>
                  <span className="block text-xs text-zinc-400">
                    {s.company} · {s.stage} · waiting {s.daysWaiting}d
                  </span>
                </span>
                <span className="flex gap-1" role="group" aria-label="Channel">
                  {channels.map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannelFor((p) => ({ ...p, [s.jobId]: c }))}
                      aria-pressed={(channelFor[s.jobId] ?? "EMAIL") === c}
                      className={`rounded px-1.5 py-1 text-[10px] font-bold ${
                        (channelFor[s.jobId] ?? "EMAIL") === c
                          ? "bg-cyan-400/15 text-cyan-200"
                          : "text-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {c.slice(0, 5)}
                    </button>
                  ))}
                </span>
                <button
                  onClick={() => void schedule(s)}
                  disabled={busy === `s${s.jobId}`}
                  className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500"
                >
                  {busy === `s${s.jobId}` ? "…" : "Queue nudge"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {scheduled.length === 0 && suggested.length === 0 && (
        <p className="rounded-xl border border-dashed border-violet-400/20 p-6 text-center text-sm text-zinc-500">
          Queue clear. Engaged missions waiting 4+ days will surface here automatically.
        </p>
      )}
    </div>
  );
}
