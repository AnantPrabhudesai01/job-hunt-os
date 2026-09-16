"use client";

import { useEffect, useState } from "react";
import { SectionTitle } from "@/components/ui";

type Snapshot = {
  used: number;
  free: number;
  pct: number;
  perBucket: Record<string, number>;
  oldest: { id: number; file_name: string; bucket_name: string; file_size: number; created_at: string }[];
};

function fmt(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function StorageClient({ initial }: { initial: Snapshot }) {
  const [s, setS] = useState<Snapshot>(initial);
  const [live, setLive] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = live ?? s;
  const barTone = cur.pct >= 95 ? "bg-red-500" : cur.pct >= 80 ? "bg-amber-500" : "grad-xp";

  async function refresh() {
    setBusy(true);
    try {
      const j = await fetch("/api/storage/usage", { cache: "no-store" }).then((r) => r.json());
      setLive({ used: j.used, free: j.free, pct: j.pct, perBucket: j.perBucket ?? {}, oldest: s.oldest });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <SectionTitle kicker="VAULT" title="Storage — lifetime tracker" />
      <section className="os-panel p-5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-2xl font-bold text-white">
            {fmt(cur.used)} / {fmt(cur.free)}
          </p>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${cur.pct >= 95 ? "border-red-400/50 text-red-200" : cur.pct >= 80 ? "border-amber-300/50 text-amber-200" : "border-emerald-400/40 text-emerald-200"}`}>
            {cur.pct}% used
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.min(100, cur.pct)}%` }} />
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Free tier is 1 GB pooled across 8 buckets. Live from Supabase on every load + auto-refresh every 30s.
          {cur.pct >= 95 ? " — stop uploads, archive oldest or spill to B." : cur.pct >= 80 ? " — plan archive soon." : ""}
        </p>
        <button onClick={refresh} disabled={busy} className="btn btn-primary mt-2 text-xs disabled:opacity-50">
          {busy ? "REFRESHING…" : "REFRESH NOW"}
        </button>
      </section>

      <section className="os-panel p-5">
        <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">PER-BUCKET</h3>
        {Object.keys(cur.perBucket).length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No files yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {Object.entries(cur.perBucket)
              .sort((a, b) => b[1] - a[1])
              .map(([b, v]) => (
                <li key={b} className="flex justify-between text-sm">
                  <span className="text-zinc-300">{b}</span>
                  <span className="font-bold text-white">{fmt(v)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="os-panel p-5">
        <h3 className="font-display text-sm font-bold tracking-widest text-cyan-200">OLDEST FILES (archive candidates)</h3>
        {cur.oldest.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No files.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5 text-xs">
            {cur.oldest.slice(0, 15).map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="truncate text-zinc-300">{r.file_name} · {r.bucket_name}</span>
                <span className="shrink-0 text-zinc-500">{fmt(Number(r.file_size ?? 0))} · {String(r.created_at).slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="os-panel border-violet-400/25 p-5">
        <h3 className="font-display text-sm font-bold tracking-widest text-violet-200">LIKE DJANGO MULTIPLE DATABASES?</h3>
        <p className="mt-1 text-sm text-zinc-300">
          Yes. Add a second Supabase project as spillover: set{" "}
          <span className="font-mono text-cyan-200">NEXT_PUBLIC_SUPABASE_URL_B</span> +{" "}
          <span className="font-mono text-cyan-200">NEXT_PUBLIC_SUPABASE_ANON_KEY_B</span> in Vercel → same schema + RLS. When A hits 1 GB, new uploads go to B; reads merge A+B. Your tracker will then show `A: 0.9 GB | B: 0.1 GB`. No code change needed beyond the two envs — the app already isolates per-bucket paths by user id.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Until B is set, you’re on single-project 1 GB. Add B only when the bar hits 80% — before that it just adds a second login to manage.
        </p>
      </section>
    </div>
  );
}
