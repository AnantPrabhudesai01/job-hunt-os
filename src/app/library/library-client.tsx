"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2, Eye, Copy, Check, Search, X } from "lucide-react";
import { DocumentPreviewModal, type PreviewTarget } from "@/components/doc-modal";

export type Doc = {
  id: number;
  file_name: string;
  document_type: string;
  bucket_name: string;
  storage_path: string | null;
  file_size: number | null;
  version: number;
  is_current: boolean;
  created_at: string;
  jobs: { mission_id: string; title: string; companies: { name?: string } | null } | null;
};

const TABS = ["All", "Resumes", "Interview Prep", "Email Drafts", "Screenshots", "Research", "Other"] as const;

function tabOf(d: Doc): string {
  if (d.document_type.includes("RESUME")) return "Resumes";
  if (d.document_type.includes("INTERVIEW")) return "Interview Prep";
  if (d.document_type.includes("EMAIL")) return "Email Drafts";
  if (d.document_type.includes("SCREENSHOT") || d.document_type.includes("IMAGE"))
    return "Screenshots";
  if (d.document_type.includes("RESEARCH")) return "Research";
  return "Other";
}

function norm(s: string) {
  return s.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function haystack(d: Doc) {
  return norm(
    [d.file_name, d.jobs?.companies?.name, d.jobs?.title, d.document_type, d.jobs?.mission_id, `v${d.version}`]
      .filter(Boolean).join(" "),
  );
}

// Relevance: filename-exact > company/role-exact > prefix > partial.
function score(d: Doc, terms: string[]): number {
  const hay = ` ${haystack(d)} `;
  const name = norm(d.file_name);
  const co = norm(d.jobs?.companies?.name ?? "");
  const role = norm(d.jobs?.title ?? "");
  let s = 0;
  for (const t of terms) {
    if (!hay.includes(` ${t}`) && !hay.includes(t)) return -1; // AND semantics
    if (name === t) s += 100;
    else if (co === t || role === t) s += 60;
    else if (name.startsWith(t) || co.startsWith(t) || role.startsWith(t)) s += 30;
    else s += 10;
  }
  return s;
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length || !text) return <>{text}</>;
  const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!esc.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${esc.join("|")})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        esc.some((e) => p.toLowerCase() === e.toLowerCase()) ? (
          <mark key={i} className="rounded bg-cyan-400/30 px-0.5 text-inherit">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function LibraryClient({ docs: initial }: { docs: Doc[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [docs, setDocs] = useState(initial);
  useEffect(() => setDocs(initial), [initial]);
  const [q, setQ] = useState(params.get("q") ?? "");
  const [tab, setTab] = useState<(typeof TABS)[number]>("All");
  const [busy, setBusy] = useState<number | null>(null);
  const [preview, setPreview] = useState<Doc | null>(null);
  const [quickCopied, setQuickCopied] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K focuses search; ESC clears it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQ("");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const terms = useMemo(() => norm(q).split(" ").filter(Boolean), [q]);

  const shown = useMemo(() => {
    const rows = docs
      .filter((d) => tab === "All" || tabOf(d) === tab)
      .map((d) => ({ d, s: terms.length ? score(d, terms) : 0 }))
      .filter((r) => (terms.length ? r.s >= 0 : true))
      .sort((a, b) => (terms.length ? b.s - a.s : 0));
    return rows.map((r) => r.d);
  }, [docs, tab, terms]);

  async function remove(id: number, name: string) {
    if (!confirm(`Delete "${name}" from cloud + registry? Local copies are never touched.`))
      return;
    setBusy(id);
    const res = await fetch(`/api/docs/delete?id=${id}`, { method: "DELETE" });
    setBusy(null);
    if (res.ok) {
      setDocs((ds) => ds.filter((d) => d.id !== id)); // instant, no reload
      router.refresh(); // revalidate server data silently in background
    } else alert("Delete failed — record kept, nothing lost.");
  }

  async function quickCopy(d: Doc) {
    try {
      const r = await fetch(`/api/docs/content?id=${d.id}`);
      const j = await r.json();
      if (j.kind !== "text" || !j.text) throw new Error("not text");
      await navigator.clipboard.writeText(j.text);
      setQuickCopied(d.id);
      setTimeout(() => setQuickCopied(null), 1500);
    } catch {
      alert("Copy failed — open preview and copy from there.");
    }
  }

  function isTextDoc(d: Doc) {
    const n = d.file_name.toLowerCase();
    return d.document_type === "EMAIL_DRAFT" || n.endsWith(".txt") || n.endsWith(".md");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents, companies, roles…"
          aria-label="Search documents"
          className="w-full rounded-lg border os-hud-line bg-zinc-950/80 py-2.5 pl-9 pr-9 text-sm outline-none backdrop-blur transition-all placeholder:text-zinc-600 focus:border-cyan-400/70 focus:shadow-[0_0_20px_rgba(34,211,238,0.15)]"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <p className="text-xs text-zinc-500" aria-live="polite">
        {terms.length
          ? `${shown.length} matching document${shown.length === 1 ? "" : "s"}`
          : `${docs.length} document${docs.length === 1 ? "" : "s"}`}
      </p>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Document types">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${
              tab === t
                ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-200"
                : "os-hud-line text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        terms.length ? (
          <div className="os-panel p-8 text-center">
            <p className="font-display text-sm font-bold tracking-[0.15em] text-zinc-200">
              NO DOCUMENTS FOUND FOR “{q.trim().toUpperCase()}”
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
              Try another company name, role, document type, or a partial keyword.
            </p>
          </div>
        ) : (
          <EmptyStateFallback />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((d) => (
            <li key={d.id}>
              <div className="card-hover os-panel p-4">
                <p className="break-all text-sm font-semibold text-white">
                  <Highlight text={d.file_name} terms={terms} />
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  <Highlight text={d.jobs?.companies?.name ?? ""} terms={terms} />
                  {d.jobs?.companies?.name ? " · " : ""}
                  <Highlight text={d.jobs?.title ?? ""} terms={terms} />
                  {" "}· v{d.version}
                  {d.is_current ? " · CURRENT" : ""}
                </p>
                <p className="text-xs text-zinc-500">
                  {d.document_type} ·{" "}
                  {d.file_size ? `${Math.round(d.file_size / 1024)} KB` : "size unknown"} ·{" "}
                  {d.created_at.slice(0, 10)} ·{" "}
                  {d.storage_path ? (
                    <span className="text-emerald-300">☁ SYNCED</span>
                  ) : (
                    <span className="text-amber-300">⚠ LOCAL ONLY</span>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => setPreview(d)}
                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-bold tracking-wider hover:bg-sky-500"
                  >
                    <Eye size={12} aria-hidden /> PREVIEW
                  </button>
                  {isTextDoc(d) && d.storage_path && (
                    <button
                      onClick={() => void quickCopy(d)}
                      className="inline-flex items-center gap-1 rounded-md border os-hud-line px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
                      aria-live="polite"
                    >
                      {quickCopied === d.id ? (
                        <>
                          <Check size={12} aria-hidden /> COPIED
                        </>
                      ) : (
                        <>
                          <Copy size={12} aria-hidden /> COPY
                        </>
                      )}
                    </button>
                  )}
                  <span className="flex-1" />
                  <button
                    onClick={() => void remove(d.id, d.file_name)}
                    disabled={busy === d.id}
                    className="inline-flex items-center gap-1 rounded-md border border-red-400/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                  >
                    <Trash2 size={12} aria-hidden /> Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <DocumentPreviewModal
        target={preview ? { kind: "doc", id: preview.id } : null}
        head={
          preview
            ? {
                fileName: preview.file_name,
                company: preview.jobs?.companies?.name,
                role: preview.jobs?.title,
                type: preview.document_type,
                sync: preview.storage_path ? "☁ SYNCED" : "⚠ LOCAL ONLY",
              }
            : { fileName: "" }
        }
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

function EmptyStateFallback() {
  return (
    <div className="os-panel p-8 text-center">
      <p className="font-display text-sm font-bold tracking-[0.15em] text-zinc-200">VAULT EMPTY HERE</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-400">
        No documents match. Upload evidence from any mission page, or run the local-file migration to sync existing PDFs.
      </p>
    </div>
  );
}

export type { PreviewTarget };
