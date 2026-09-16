"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check, Link2 } from "lucide-react";
import { SOURCE_COLORS } from "@/lib/game";

function isHttp(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\/.+\..+/.test(u.trim());
}

function domainOf(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function CopyLink({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1800);
        }).catch(() => alert("Copy failed."));
      }}
      className="inline-flex items-center gap-1.5 rounded-md border os-hud-line px-3 py-2 text-xs font-bold tracking-wider hover:bg-white/5"
      aria-live="polite"
    >
      {ok ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
      {ok ? "✓ COPIED" : "📋 COPY LINK"}
    </button>
  );
}

function OpenButton({ url, label, actionLabel }: { url: string; label: string; actionLabel: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={actionLabel}
      className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-xs font-bold tracking-wider hover:bg-sky-500"
    >
      <Link2 size={13} aria-hidden />
      {label}
    </a>
  );
}

export function SourcePanel({
  sourceType,
  postUrl,
  author,
  authorRole,
  dateDisplay,
  dateNote,
  jobUrl,
  companyName,
  companyLinkedin,
}: {
  sourceType: string | null;
  postUrl: string | null;
  author: string | null;
  authorRole: string | null;
  dateDisplay: string | null;
  dateNote: string | null;
  jobUrl: string | null;
  companyName?: string | null;
  companyLinkedin?: string | null;
}) {
  const post = isHttp(postUrl) ? postUrl.trim() : null;
  const apply = isHttp(jobUrl) ? jobUrl!.trim() : null;
  const coLi = isHttp(companyLinkedin) ? companyLinkedin!.trim() : null;
  // Person profile URLs: only rendered when a real stored URL exists.
  // No author profile URL is on file for any current mission, so none renders (never guessed).

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wider ${SOURCE_COLORS[sourceType ?? ""] ?? "os-hud-line text-zinc-300"}`}>
          {(sourceType ?? "UNKNOWN").replace(/_/g, " ")}
        </span>
      </div>

      {post ? (
        <div>
          <p className="text-[11px] tracking-widest text-zinc-500">ORIGINAL POST</p>
          <p className="font-mono text-[13px] text-zinc-400">{domainOf(post)}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <OpenButton url={post} label="🔗 OPEN ORIGINAL POST" actionLabel="Open original post" />
            <CopyLink url={post} />
          </div>
        </div>
      ) : apply ? (
        <div>
          <p className="text-[11px] tracking-widest text-zinc-500">
            SOURCE LINK — listing page = application page
          </p>
          <p className="font-mono text-[13px] text-zinc-400">{domainOf(apply)}</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <OpenButton url={apply} label="🔗 OPEN SOURCE" actionLabel="Open source listing" />
            <CopyLink url={apply} />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-[11px] tracking-widest text-zinc-500">ORIGINAL POST</p>
          <p className="text-xs text-zinc-500">NOT AVAILABLE — no URL on record (never fabricated).</p>
        </div>
      )}

      {(author || dateDisplay) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {author && (
            <div>
              <p className="text-[11px] tracking-widest text-zinc-500">POSTED BY</p>
              <p className="text-zinc-100">
                {author}
                {authorRole ? <span className="block text-xs text-zinc-400">{authorRole}</span> : null}
              </p>
            </div>
          )}
          {dateDisplay && (
            <div>
              <p className="text-[11px] tracking-widest text-zinc-500">POST DATE</p>
              <p className="text-zinc-100">{dateDisplay}</p>
              {dateNote && <p className="text-xs text-zinc-500">{dateNote}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {coLi && (
          <div>
            <p className="text-[11px] tracking-widest text-zinc-500">
              COMPANY — {companyName ?? ""}
            </p>
            <a
              href={coLi}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open company LinkedIn"
              className="text-xs text-cyan-300"
            >
              OPEN COMPANY LINKEDIN ↗
            </a>
          </div>
        )}
        {apply && post && (
          <div>
            <p className="text-[11px] tracking-widest text-zinc-500">APPLICATION</p>
            <a
              href={apply}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open application page"
              className="text-xs text-cyan-300"
            >
              OPEN APPLICATION ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
