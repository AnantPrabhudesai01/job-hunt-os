"use client";

import { useState } from "react";

// Compact interview-prep minutes logger. Posts to /api/sprint/log-prep;
// shows the running total for today. No-ops gracefully with no active run.
export function PrepLogger({ initialMinutes }: { initialMinutes: number }) {
  const [mins, setMins] = useState("");
  const [total, setTotal] = useState(initialMinutes);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function log() {
    const n = Number(mins.replace(/[^0-9]/g, ""));
    if (!n || n < 1) {
      setNote("Enter minutes first.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/sprint/log-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes: Math.min(960, n) }),
      });
      const j = await res.json();
      if (!res.ok) {
        setNote(j.error ?? "Could not save.");
        return;
      }
      setTotal(j.total as number);
      setMins("");
    } catch {
      setNote("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const h = Math.floor(total / 60);
  const m = total % 60;
  return (
    <div>
      <p className="font-display text-xl font-bold text-white">
        {h > 0 ? `${h}h ${m}m` : `${m}m`}
      </p>
      <div className="mt-1 flex gap-1.5">
        <input
          value={mins}
          onChange={(e) => setMins(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
          placeholder="min"
          inputMode="numeric"
          className="w-16 rounded-md border os-hud-line bg-black/30 px-2 py-1 text-xs text-white placeholder:text-zinc-600"
        />
        <button
          onClick={log}
          disabled={busy}
          className="rounded-md border border-cyan-400/25 px-2 py-1 text-xs font-bold text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-50"
        >
          + LOG
        </button>
      </div>
      {note && <p className="mt-1 text-[11px] text-amber-200">{note}</p>}
    </div>
  );
}
