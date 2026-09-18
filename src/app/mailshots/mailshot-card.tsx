"use client";

import { useState } from "react";

// One mailshot card: HR/person + company names up front, copy helpers,
// shared-resume download, manual I SENT IT (records only — you send).
export function MailshotCard({
  row,
  draft,
  resumeUrl,
}: {
  row: {
    id: number;
    email: string;
    company: string | null;
    person: string | null;
    title: string | null;
    phone: string | null;
    status: string;
    sent_at: string | null;
  };
  draft: { subject: string; body: string };
  resumeUrl: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [sent, setSent] = useState(row.status === "SENT");
  const [busy, setBusy] = useState(false);

  async function copy(kind: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied("failed");
    }
  }

  async function markSent() {
    if (sent || busy) return;
    setBusy(true);
    const res = await fetch("/api/mailshots/sent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    setBusy(false);
    if (res.ok) setSent(true);
  }

  return (
    <div
      className={`os-panel p-4 ${
        sent ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-bold text-white">
            {row.email}
          </p>
          <p className="mt-0.5 text-sm text-zinc-200">
            {row.person ? (
              <span className="font-semibold text-cyan-200">{row.person}</span>
            ) : (
              <span className="text-zinc-500">HR name unknown</span>
            )}
            {row.company ? (
              <span className="text-zinc-400"> · {row.company}</span>
            ) : (
              <span className="text-zinc-600"> · company unknown</span>
            )}
          </p>
          {(row.title || row.phone) && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {[row.title, row.phone].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
            sent
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
              : "border-zinc-600 text-zinc-400"
          }`}
        >
          {sent ? "SENT" : "NEW"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={() => copy("mail", draft.body)}
          className="rounded-md bg-sky-600 px-2.5 py-1.5 font-semibold hover:bg-sky-500"
        >
          {copied === "mail" ? "✓ COPIED" : "COPY MAIL"}
        </button>
        <button
          type="button"
          onClick={() => copy("email", row.email)}
          className="rounded-md border border-zinc-700 px-2.5 py-1.5 hover:bg-white/5"
        >
          {copied === "email" ? "✓ COPIED" : "COPY EMAIL"}
        </button>
        {resumeUrl && (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 hover:bg-white/5"
          >
            RESUME ↓
          </a>
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-md border border-zinc-700 px-2.5 py-1.5 hover:bg-white/5"
        >
          {show ? "HIDE DRAFT" : "VIEW DRAFT"}
        </button>
        {!sent && (
          <button
            type="button"
            onClick={markSent}
            disabled={busy}
            className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 font-bold text-emerald-200 disabled:opacity-50"
          >
            {busy ? "…" : "I SENT IT"}
          </button>
        )}
      </div>
      {show && (
        <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-300">
          {draft.body}
        </pre>
      )}
      {sent && row.sent_at && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Sent {String(row.sent_at).slice(0, 10)} (your Gmail — recorded only)
        </p>
      )}
    </div>
  );
}
