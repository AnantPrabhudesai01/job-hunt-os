"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy, Lock, Search } from "lucide-react";
import { ACHIEVEMENTS, RARITY_STYLE, type AchDef } from "@/lib/achievements-data";
import { Reveal } from "@/components/reveal";
import { CelebrationHost, type Unlocked } from "@/components/celebration";

export type Owned = Record<string, { at: string; xp: number }>;

type Row = { a: AchDef; o: Owned[string] | undefined; p: number; done: boolean };

export function TrophiesClient({
  owned,
  progress,
}: {
  owned: Owned;
  progress: Record<string, number>;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("ALL");
  const [sort, setSort] = useState<"recent" | "rarity" | "progress" | "xp">("recent");
  const [detail, setDetail] = useState<AchDef | null>(null);
  const [queue, setQueue] = useState<Unlocked[]>([]);
  useEffect(() => {
    fetch("/api/achievements/pending")
      .then((r) => r.json())
      .then((j) => setQueue(j.queue ?? []))
      .catch(() => {});
  }, []);

  const cats = useMemo(
    () => ["ALL", ...Array.from(new Set(ACHIEVEMENTS.map((a) => a.category)))],
    [],
  );
  const order: Record<string, number> = { LEGENDARY: 0, EPIC: 1, RARE: 2, UNCOMMON: 3, COMMON: 4 };

  const rows: Row[] = useMemo((): Row[] => {
    const t = q.trim().toLowerCase();
    const list = ACHIEVEMENTS.filter(
      (a) =>
        (cat === "ALL" || a.category === cat) &&
        (!t || a.title.toLowerCase().includes(t) || a.desc.toLowerCase().includes(t)),
    ).map((a) => {
      const o = owned[a.id];
      const p = Math.min(progress[a.id] ?? 0, a.target);
      return { a, o, p, done: Boolean(o) };
    });
    const by = {
      recent: (x: Row, y: Row) =>
        (y.o?.at ?? "").localeCompare(x.o?.at ?? ""),
      rarity: (x: Row, y: Row) =>
        order[x.a.rarity] - order[y.a.rarity],
      progress: (x: Row, y: Row) =>
        y.p / y.a.target - x.p / x.a.target,
      xp: (x: Row, y: Row) => y.a.xp - x.a.xp,
    }[sort];
    return [...list].sort(by);
  }, [q, cat, sort, owned, progress]);

  const doneCount = Object.keys(owned).length;
  const totalXp = Object.values(owned).reduce((s, o) => s + o.xp, 0);
  const next = ACHIEVEMENTS.filter((a) => !owned[a.id])
    .map((a) => ({ a, r: (progress[a.id] ?? 0) / a.target }))
    .sort((x, y) => y.r - x.r)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <section className="os-panel border-yellow-300/25 p-5 text-center shadow-[0_0_36px_rgba(253,224,71,0.08)]">
        <p className="font-display text-[11px] font-bold tracking-[0.25em] text-yellow-200">HALL OF FAME</p>
        <p className="font-display mt-1 text-2xl font-bold text-white">
          {doneCount} / {ACHIEVEMENTS.length} UNLOCKED
        </p>
        <p className="text-sm text-zinc-400">
          {Math.round((doneCount / ACHIEVEMENTS.length) * 100)}% complete · {totalXp} achievement XP
        </p>
      </section>

      {next.length > 0 && (
        <section>
          <p className="mb-2 font-display text-xs font-bold tracking-[0.2em] text-cyan-200">NEXT TO UNLOCK</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {next.map(({ a }) => (
              <div key={a.id} className="os-panel p-3 text-sm">
                <p className="font-bold text-white">{a.title}</p>
                <p className="text-xs text-zinc-400">
                  {Math.min(progress[a.id] ?? 0, a.target)} / {a.target} · {a.better}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search achievements…"
            aria-label="Search achievements"
            className="w-full rounded-lg border os-hud-line bg-zinc-950/80 py-2 pl-9 pr-3 text-sm outline-none focus:border-yellow-300/60"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cats.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wider ${cat === c ? "border-yellow-300/60 bg-yellow-300/10 text-yellow-200" : "os-hud-line text-zinc-400 hover:text-zinc-100"}`}>
              {c.toUpperCase()}
            </button>
          ))}
          <select value={sort} onChange={(e) => setSort(e.target.value as never)} aria-label="Sort" className="ml-auto rounded-md border os-hud-line bg-zinc-950 px-2 py-1 text-xs">
            <option value="recent">Recently unlocked</option>
            <option value="rarity">Rarity</option>
            <option value="progress">Progress</option>
            <option value="xp">XP reward</option>
          </select>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ a, o, p, done }) => (
          <li key={a.id}>
            <Reveal>
              <button
                onClick={() => setDetail(a)}
                className={`card-hover os-panel w-full p-4 text-left ${done ? "border-yellow-300/40 shadow-[0_0_24px_rgba(253,224,71,0.1)]" : "opacity-80"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${done ? "border-yellow-300/60 bg-yellow-300/10 text-yellow-200" : "os-hud-line text-zinc-600"}`}>
                    {done ? <Trophy size={18} aria-hidden /> : <Lock size={16} aria-hidden />}
                  </span>
                  <span>
                    <span className="block font-display text-sm font-bold text-white">{a.title}</span>
                    <span className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${RARITY_STYLE[a.rarity]}`}>
                      {a.rarity}
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-400">{a.desc}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full ${done ? "grad-gold" : "grad-xp"}`} style={{ width: `${Math.round((p / a.target) * 100)}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {done ? `UNLOCKED ${o!.at.slice(0, 10)} · +${o!.xp} XP` : `${p} / ${a.target} · ${a.better}`}
                </p>
              </button>
            </Reveal>
          </li>
        ))}
      </ul>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={detail.title}>          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="os-panel relative w-full max-w-sm border-yellow-300/30 p-5">
            <p className="font-display text-lg font-bold text-white">{detail.title}</p>
            <p className="mt-1 text-sm text-zinc-300">{detail.desc}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-zinc-500">CATEGORY</dt><dd className="font-bold text-white">{detail.category}</dd></div>
              <div><dt className="text-zinc-500">RARITY</dt><dd className="font-bold text-yellow-200">{detail.rarity}</dd></div>
              <div><dt className="text-zinc-500">PROGRESS</dt><dd className="font-bold text-white">{Math.min(progress[detail.id] ?? 0, detail.target)} / {detail.target}</dd></div>
              <div><dt className="text-zinc-500">REWARD</dt><dd className="font-bold text-amber-200">+{detail.xp} XP</dd></div>
            </dl>
            <p className="mt-2 text-xs text-zinc-400">How: {detail.better}</p>
            <button onClick={() => setDetail(null)} className="btn btn-ghost mt-4 text-xs">CLOSE</button>
          </div>
        </div>
      )}
    </div>
  );
}
