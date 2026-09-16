"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Check, ExternalLink, Eye } from "lucide-react";
import { SectionTitle } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { DocumentPreviewModal } from "@/components/doc-modal";

type Item = {
  kind: string; id: string; title: string; subtitle: string;
  href?: string; external?: string; docId?: number; email?: string; source?: string;
};
type Group = { group: string; items: Item[] };
const FILTERS = ["ALL", "COMPANIES", "JOBS", "CONTACTS", "EMAILS", "DOCUMENTS", "LINKEDIN", "MY POSTS", "GROUP POSTS"] as const;

function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("ALL");
  const [preview, setPreview] = useState<{ id: number; name: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setGroups([]); return; }
    setBusy(true);
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => { setGroups(j.groups ?? []); setBusy(false); })
        .catch(() => setBusy(false));
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const shown = groups.filter((g) => {
    if (filter === "ALL") return true;
    if (filter === "JOBS") return g.group === "JOBS";
    return g.group === filter;
  });

  function copy(t: string, key: string) {
    void navigator.clipboard.writeText(t).then(() => {
      setCopied(key); setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => { e.preventDefault(); router.push(`/search?q=${encodeURIComponent(input.trim())}`); }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search jobs, companies, people, documents…"
          aria-label="Global search"
          className="w-full rounded-lg border os-hud-line bg-zinc-950/80 px-3 py-2.5 text-sm outline-none focus:border-cyan-400/70"
        />
      </form>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Result type filters">
        {FILTERS.map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${filter === f ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200" : "os-hud-line text-zinc-400 hover:text-zinc-100"}`}>
            {f}
          </button>
        ))}
      </div>
      {busy && <p className="text-xs tracking-widest text-zinc-500">SEARCHING…</p>}
      {!busy && q.trim().length >= 2 && shown.every((g) => g.items.length === 0) && (
        <div className="os-panel p-8 text-center">
          <p className="font-bold text-white">NO RESULTS for “{q.trim()}”</p>
          <p className="mt-1 text-sm text-zinc-400">Try company, role, person, email, document, or job ID.</p>
        </div>
      )}
      {shown.map((g) => (
        <section key={g.group} className="os-panel p-4">
          <SectionTitle kicker="RESULTS" title={`${g.group} (${g.items.length})`} />
          <ul className="flex flex-col gap-2">
            {g.items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 rounded-lg border os-hud-line p-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{it.title}</span>
                  {it.subtitle && <span className="block truncate text-xs text-zinc-500">{it.subtitle}</span>}
                  {it.source && <span className="block truncate text-xs text-zinc-600">Source: {it.source}</span>}
                </span>
                {it.email && (
                  <button onClick={() => copy(it.email as string, it.id)} className="shrink-0 rounded border os-hud-line px-2 py-1 text-[11px] text-cyan-200" aria-live="polite">
                    {copied === it.id ? "✓ COPIED" : "COPY EMAIL"}
                  </button>
                )}
                {it.docId && (
                  <button onClick={() => setPreview({ id: it.docId as number, name: it.title })} className="shrink-0 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-bold hover:bg-sky-500">
                    PREVIEW
                  </button>
                )}
                {it.external && (
                  <a href={it.external} target="_blank" rel="noreferrer" className="shrink-0 rounded border os-hud-line px-2 py-1 text-[11px] text-cyan-200">
                    OPEN <ExternalLink size={10} className="inline" aria-hidden />
                  </a>
                )}
                {it.href && (
                  <Link href={it.href} className="shrink-0 rounded border os-hud-line px-2 py-1 text-[11px] hover:text-white">
                    VIEW
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <DocumentPreviewModal
        target={preview ? { kind: "doc", id: preview.id } : null}
        head={{ fileName: preview?.name ?? "" }}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchResults />
    </Suspense>
  );
}
