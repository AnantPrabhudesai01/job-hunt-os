"use client";

import { useState } from "react";

export type MyPost = {
  id: number;
  url: string | null;
  title: string | null;
  body: string | null;
  post_type: string | null;
  project_assoc: string | null;
  challenge_day: number | null;
  status: "DRAFT" | "POSTED";
  posted_date: string | null;
  likes: number;
  comments: number;
  reposts: number;
  created_at: string;
};

export function PostsClient({ initial }: { initial: MyPost[] }) {
  const [posts, setPosts] = useState<MyPost[]>(initial);
  const [busy, setBusy] = useState<number | null>(null);

  async function patch(id: number, body: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch("/api/my-posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok)
        setPosts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...body } as MyPost : p)),
        );
    } finally {
      setBusy(null);
    }
  }

  async function bump(id: number, field: "likes" | "comments" | "reposts", cur: number) {
    const v = prompt(`Set ${field} count:`, String(cur));
    if (v === null) return;
    const n = Math.max(0, Math.min(1000000, Number(v.replace(/[^0-9]/g, "")) || 0));
    await patch(id, { [field]: n });
  }

  return (
    <div className="overflow-x-auto rounded-xl border os-hud-line">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b os-hud-line text-[11px] tracking-widest text-zinc-500">
            {["POST", "TYPE", "DAY", "STATUS", "DATE", "ENGAGEMENT", "ACTIONS"].map((h) => (
              <th key={h} className="px-3 py-2 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {posts.map((p) => (
            <tr key={p.id} className="border-b border-white/5 align-top">
              <td className="px-3 py-2">
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold text-cyan-200 hover:text-white">
                    {p.title ?? "Untitled post"} ↗
                  </a>
                ) : (
                  <span className="font-semibold text-white">{p.title ?? "Untitled post"}</span>
                )}
                {p.project_assoc && (
                  <span className="block text-xs text-zinc-500">{p.project_assoc}</span>
                )}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-400">{p.post_type ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-zinc-300">
                {p.challenge_day ? `Day ${p.challenge_day}` : "—"}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                    p.status === "POSTED"
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/40 bg-amber-300/10 text-amber-200"
                  }`}
                >
                  {p.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-zinc-400">
                {(p.posted_date ?? p.created_at ?? "").slice(0, 10)}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-300">
                {(p.likes ?? 0)}♥ {(p.comments ?? 0)}💬 {(p.reposts ?? 0)}↻
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {p.status === "DRAFT" ? (
                    <button
                      onClick={() => patch(p.id, { status: "POSTED" })}
                      disabled={busy === p.id}
                      className="rounded border border-emerald-400/40 px-2 py-1 font-bold text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"
                    >
                      MARK POSTED
                    </button>
                  ) : (
                    <>
                      <button onClick={() => bump(p.id, "likes", p.likes ?? 0)} className="rounded border os-hud-line px-2 py-1 text-zinc-300 hover:text-white">♥</button>
                      <button onClick={() => bump(p.id, "comments", p.comments ?? 0)} className="rounded border os-hud-line px-2 py-1 text-zinc-300 hover:text-white">💬</button>
                      <button onClick={() => bump(p.id, "reposts", p.reposts ?? 0)} className="rounded border os-hud-line px-2 py-1 text-zinc-300 hover:text-white">↻</button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
