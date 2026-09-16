"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SprintStart() {
  const router = useRouter();
  const [date, setDate] = useState("2026-09-15");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="os-panel p-5">
      <p className="text-sm text-zinc-400">
        No active run. Pick the challenge start date — 30 day rows are created, one per day.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Sprint start date"
          className="rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400"
        />
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch("/api/sprint/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ start_date: date }),
              });
              const j = await res.json();
              if (!res.ok) throw new Error(j.error ?? "Start failed.");
              router.refresh();
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Start failed.");
            } finally {
              setBusy(false);
            }
          }}
          className="btn btn-primary text-sm disabled:opacity-40"
        >
          {busy ? "Starting…" : "START 30-DAY SPRINT"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </div>
  );
}
