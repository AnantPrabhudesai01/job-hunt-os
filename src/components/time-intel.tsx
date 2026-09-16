"use client";

import { useEffect, useState } from "react";
import { freshness, deadlineStatus, relative } from "@/lib/time";

export function TimeIntel({
  postedAt,
  postedDisplay,
  postedPrecision,
  postedConfidence,
  postedSource,
  deadline,
  followupDue,
  followupWho,
}: {
  postedAt: string | null;
  postedDisplay: string | null;
  postedPrecision: string | null;
  postedConfidence: string | null;
  postedSource: string | null;
  deadline: string | null;
  followupDue: string | null;
  followupWho: string | null;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);
  const fresh = freshness(postedAt);
  const dl = deadlineStatus(deadline);

  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      <span
        className={`rounded-full border os-hud-line px-2.5 py-1 ${fresh.color}`}
        title={
          postedAt
            ? `Posted: ${postedDisplay ?? postedAt} · precision ${postedPrecision ?? "?"} · ${postedConfidence ?? ""} · source: ${postedSource ?? "?"}`
            : "Post date unknown — verify listing"
        }
      >
        POSTED:{" "}
        {postedAt
          ? `${postedDisplay ?? relative(postedAt)} · ${fresh.label}`
          : "unknown"}
      </span>
      <span
        className={`rounded-full border px-2.5 py-1 ${
          dl.passed || dl.urgent
            ? "border-red-400/50 bg-red-400/10 font-bold text-red-200"
            : "os-hud-line text-zinc-300"
        }`}
      >
        {dl.passed ? "DEADLINE PASSED" : `DEADLINE: ${dl.text}`}
      </span>
      {followupDue && (
        <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2.5 py-1 text-violet-200">
          FOLLOW-UP {relative(followupDue)}
          {followupWho ? ` · ${followupWho}` : ""}
        </span>
      )}
    </div>
  );
}
