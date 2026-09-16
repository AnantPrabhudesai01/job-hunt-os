"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Copy, Check, ExternalLink } from "lucide-react";
import type { SearchItem } from "@/lib/search";
import { DocumentPreviewModal } from "@/components/doc-modal";

type Group = { group: string; items: SearchItem[] };

const KIND_STYLE: Record<string, string> = {
  COMPANY: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  JOB: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  CONTACT: "border-pink-400/40 bg-pink-400/10 text-pink-200",
  EMAIL: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  DOCUMENT: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  LINKEDIN: "border-blue-400/40 bg-blue-400/10 text-blue-200",
  MY_POST: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
  GROUP_POST: "border-lime-400/40 bg-lime-400/10 text-lime-200",
};

export function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewName, setPreviewName] = useState("");
  const reqId = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setGroups([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => {
          if (reqId.current !== id) return; // stale loses
          setGroups(j.groups ?? []);
          setActive(0);
          setBusy(false);
        })
        .catch(() => {
          if (reqId.current === id) setBusy(false);
        });
    }, 220);
    return () => clearTimeout(t);
  }, [q]);

  const flat = groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.group })));

  const go = useCallback(
    (it: SearchItem) => {
      if (it.external) {
        window.open(it.external, "_blank", "noopener,noreferrer");
      } else if (it.docId) {
        setPreviewName(it.title);
        setPreviewId(it.docId);
      } else if (it.href) {
        router.push(it.href);
      }
      setOpen(false);
    },
    [router],
  );

  function copyEmail(e: React.MouseEvent, email: string, key: string) {
    e.stopPropagation();
    void navigator.clipboard.writeText(email).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div ref={boxRef} className="relative hidden min-w-52 flex-1 md:block md:max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-violet-400/25 bg-zinc-950/80 px-2.5 py-1.5 backdrop-blur transition-all focus-within:border-cyan-400/60 focus-within:shadow-[0_0_18px_rgba(34,211,238,0.2)]">
        <Search size={14} className="shrink-0 text-zinc-500" aria-hidden />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === "Enter" && flat[active]) go(flat[active]);
          }}
          placeholder="Search jobs, companies, people, documents…"
          aria-label="Global search"
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
        />
        {q ? (
          <button onClick={() => setQ("")} aria-label="Clear search" className="rounded p-0.5 text-zinc-400 hover:text-white">
            <X size={13} aria-hidden />
          </button>
        ) : (
          <kbd className="rounded border os-hud-line px-1 text-[10px] text-zinc-500">Ctrl K</kbd>
        )}
      </div>

      {open && (q.trim().length >= 2) && (
        <div className="os-panel absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[60vh] overflow-y-auto border-violet-400/25 p-2 shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
          {busy && groups.length === 0 && (
            <p className="p-3 text-xs tracking-widest text-zinc-500">SEARCHING…</p>
          )}
          {!busy && flat.length === 0 && (
            <div className="p-3 text-sm">
              <p className="font-bold text-white">NO RESULTS for “{q.trim()}”</p>
              <p className="mt-1 text-xs text-zinc-400">Try company, role, person, email, document, or job ID.</p>
            </div>
          )}
          {groups.map((g) => (
            <div key={g.group} className="mb-1">
              <p className="px-2 pb-1 pt-2 text-[10px] font-bold tracking-[0.18em] text-zinc-500">{g.group}</p>
              <ul>
                {g.items.map((it) => {
                  const idx = flat.indexOf(it as (typeof flat)[number]);
                  return (
                    <li key={it.id}>
                      <div
                        role="option"
                        aria-selected={idx === active}
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(it)}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${idx === active ? "bg-cyan-400/10" : ""}`}
                      >
                        <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold ${KIND_STYLE[it.kind] ?? "os-hud-line text-zinc-300"}`}>
                          {it.kind}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-zinc-100">{it.title}</span>
                          {it.subtitle && <span className="block truncate text-xs text-zinc-500">{it.subtitle}</span>}
                        </span>
                        {it.email && (
                          <button
                            onClick={(e) => copyEmail(e, it.email as string, it.id)}
                            aria-label={`Copy ${it.email}`}
                            className="shrink-0 rounded border os-hud-line px-1.5 py-0.5 text-[11px] text-cyan-200 hover:bg-white/5"
                          >
                            {copied === it.id ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                          </button>
                        )}
                        {it.external && (
                          <ExternalLink size={12} aria-hidden className="shrink-0 text-zinc-500" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {flat.length > 0 && (
            <button
              onClick={() => { router.push(`/search?q=${encodeURIComponent(q.trim())}`); setOpen(false); }}
              className="mt-1 w-full rounded-md border os-hud-line py-1.5 text-xs font-bold tracking-wider text-cyan-200 hover:bg-white/5"
            >
              VIEW ALL RESULTS →
            </button>
          )}
        </div>
      )}
      <DocumentPreviewModal
        target={previewId ? { kind: "doc", id: previewId } : null}
        head={{ fileName: previewName }}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
