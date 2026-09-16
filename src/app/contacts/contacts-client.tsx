"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy, Check, ExternalLink, Eye, Pencil, Trash2, Plus, X,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { StatusBadge } from "@/components/ui";
import { CONTACT_TYPE_COLORS } from "@/lib/game";
import { checkAchievements, CelebrationHost, type Unlocked } from "@/components/celebration";
import { ConnectNote } from "./connect-note";

export type Contact = {
  id: number;
  name: string;
  role_title: string | null;
  contact_type: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  status: string | null;
  notes: string | null;
  created_at: string;
  last_contacted: string | null;
  companies: { id: number; name: string; company_linkedin: string | null } | null;
};

export type JobRef = { id: number; title: string; mission_id: string; company_id: number | null };
export type CompanyRef = { id: number; name: string };

const STATUSES = ["NEW","CONTACTED","CONNECTED","RESPONDED","FOLLOW-UP","REFERRAL","NO RESPONSE","CLOSED"];
const TYPES = ["HR","RECRUITER","HIRING MANAGER","EMPLOYEE","REFERRAL","FOUNDER","OTHER"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        }).catch(() => alert("Copy failed — select manually."));
      }}
      className="inline-flex items-center gap-1 rounded border os-hud-line px-1.5 py-0.5 font-mono text-[11px] text-cyan-200 hover:bg-white/5"
      aria-live="polite"
      title={`Copy ${label}`}
    >
      {ok ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
      {ok ? "✓ COPIED" : "COPY"}
    </button>
  );
}

export function ContactsClient({
  contacts, companies, jobs, initialQuery,
}: {
  contacts: Contact[];
  companies: CompanyRef[];
  jobs: JobRef[];
  initialQuery?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery ?? "");
  const [typeF, setTypeF] = useState("ALL");
  const [statusF, setStatusF] = useState("ALL");
  const [coF, setCoF] = useState("ALL");
  const [emailF, setEmailF] = useState(false);
  const [liF, setLiF] = useState(false);
  const [sort, setSort] = useState<"name"|"company"|"date"|"status">("date");
  const [show, setShow] = useState({ role: true, job: true, source: true, date: false });
  const [sel, setSel] = useState<number[]>([]);
  const [view, setView] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("CONTACTED");
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);
  const [queue, setQueue] = useState<Unlocked[]>([]);

  const jobsByCompany = useMemo(() => {
    const m = new Map<number, JobRef[]>();
    jobs.forEach((j) => {
      if (j.company_id == null) return;
      if (!m.has(j.company_id)) m.set(j.company_id, []);
      m.get(j.company_id)!.push(j);
    });
    return m;
  }, [jobs]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let rows = contacts.filter((c) => {
      if (typeF !== "ALL" && (c.contact_type ?? "OTHER") !== typeF) return false;
      if (statusF !== "ALL" && (c.status ?? "NEW") !== statusF) return false;
      if (coF !== "ALL" && String(c.companies?.id ?? "") !== coF) return false;
      if (emailF && !c.email) return false;
      if (liF && !c.linkedin_url) return false;
      if (t && ![c.name, c.companies?.name, c.role_title, c.email, c.linkedin_url, c.notes, String(c.id)]
        .filter(Boolean).join(" ").toLowerCase().includes(t)) return false;
      return true;
    });
    const by = {
      name: (a: Contact, b: Contact) => a.name.localeCompare(b.name),
      company: (a: Contact, b: Contact) =>
        (a.companies?.name ?? "").localeCompare(b.companies?.name ?? ""),
      date: (a: Contact, b: Contact) => (a.created_at < b.created_at ? 1 : -1),
      status: (a: Contact, b: Contact) => (a.status ?? "").localeCompare(b.status ?? ""),
    }[sort];
    return [...rows].sort(by);
  }, [contacts, q, typeF, statusF, coF, emailF, liF, sort]);

  const PAGE = 25;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);

  const stats = useMemo(() => ({
    total: contacts.length,
    recruiters: contacts.filter((c) => c.contact_type === "RECRUITER").length,
    hr: contacts.filter((c) => c.contact_type === "HR").length,
    hm: contacts.filter((c) => c.contact_type === "HIRING MANAGER").length,
    emails: contacts.filter((c) => c.email).length,
    li: contacts.filter((c) => c.linkedin_url).length,
  }), [contacts]);

  async function bulkCopy() {
    const list = [...new Set(
      contacts.filter((c) => sel.includes(c.id) && c.email && EMAIL_RE.test(c.email))
        .map((c) => c.email as string),
    )];
    if (!list.length) { setBulkMsg("No valid emails selected."); return; }
    try {
      await navigator.clipboard.writeText(list.join("\n"));
      setBulkMsg(`Copied ${list.length} email(s) — one per line.`);
    } catch { setBulkMsg("Copy failed."); }
  }
  async function bulkSetStatus() {
    for (const id of sel) {
      await fetch("/api/contacts", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: bulkStatus }),
      });
    }
    setBulkMsg(`Status set on ${sel.length} contact(s).`);
    setSel([]);
    router.refresh();
  }
  async function bulkDelete() {
    if (!confirm(`Delete ${sel.length} contact(s)? Records only — jobs and companies stay.`)) return;
    for (const id of sel) await fetch(`/api/contacts?id=${id}`, { method: "DELETE" });
    setSel([]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* STATS */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {[
          ["CONTACTS", stats.total], ["RECRUITERS", stats.recruiters], ["HR", stats.hr],
          ["HIRING MGRS", stats.hm], ["EMAILS", stats.emails], ["LINKEDIN", stats.li],
        ].map(([k, v]) => (
          <div key={k} className="os-panel p-2.5 text-center">
            <p className="font-display text-lg font-bold text-white">{v}</p>
            <p className="text-[10px] tracking-widest text-zinc-500">{k}</p>
          </div>
        ))}
      </div>

      {/* SEARCH + FILTERS */}
      <div className="os-panel flex flex-col gap-2 p-3">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(0); }}
          placeholder="Search people, companies, emails, roles…"
          aria-label="Search contacts"
          className="w-full rounded-md border os-hud-line bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-cyan-400"
        />
        <div className="flex flex-wrap gap-2 text-xs">
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} aria-label="Type filter" className="rounded-md border os-hud-line bg-zinc-950 px-2 py-1.5">
            {["ALL", ...TYPES].map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} aria-label="Status filter" className="rounded-md border os-hud-line bg-zinc-950 px-2 py-1.5">
            {["ALL", ...STATUSES].map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={coF} onChange={(e) => setCoF(e.target.value)} aria-label="Company filter" className="rounded-md border os-hud-line bg-zinc-950 px-2 py-1.5">
            <option value="ALL">All companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as never)} aria-label="Sort" className="rounded-md border os-hud-line bg-zinc-950 px-2 py-1.5">
            <option value="date">Newest</option>
            <option value="name">Name</option>
            <option value="company">Company</option>
            <option value="status">Status</option>
          </select>
          <label className="flex items-center gap-1 text-zinc-300">
            <input type="checkbox" checked={emailF} onChange={(e) => setEmailF(e.target.checked)} /> Has email
          </label>
          <label className="flex items-center gap-1 text-zinc-300">
            <input type="checkbox" checked={liF} onChange={(e) => setLiF(e.target.checked)} /> Has LinkedIn
          </label>
          <button onClick={() => setAdding((a) => !a)} className="ml-auto rounded-md bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-500">
            + ADD CONTACT
          </button>
        </div>
        <details className="text-xs text-zinc-400">
          <summary className="cursor-pointer">Columns</summary>
          <div className="mt-1 flex gap-3">
            {(["role", "job", "source", "date"] as const).map((c) => (
              <label key={c} className="flex items-center gap-1 capitalize">
                <input type="checkbox" checked={show[c]} onChange={() => setShow((s) => ({ ...s, [c]: !s[c] }))} /> {c}
              </label>
            ))}
          </div>
        </details>
      </div>

      {adding && <AddForm companies={companies} onDone={async () => { setAdding(false); setQueue(await checkAchievements()); router.refresh(); }} />}

      {/* BULK BAR */}
      {sel.length > 0 && (
        <div className="os-panel flex flex-wrap items-center gap-2 p-2.5 text-xs">
          <span className="font-bold text-white">{sel.length} selected</span>
          <button onClick={bulkCopy} className="rounded-md border os-hud-line px-2.5 py-1 hover:bg-white/5">COPY EMAILS</button>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="rounded-md border os-hud-line bg-zinc-950 px-2 py-1">
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={bulkSetStatus} className="rounded-md border os-hud-line px-2.5 py-1 hover:bg-white/5">SET STATUS</button>
          <button onClick={bulkDelete} className="rounded-md border border-red-400/40 px-2.5 py-1 text-red-300">DELETE</button>
          <button onClick={() => setSel([])} className="text-zinc-400">Clear</button>
          {bulkMsg && <span className="text-cyan-200">{bulkMsg}</span>}
        </div>
      )}

      {/* DESKTOP TABLE */}
      <div className="os-panel hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b os-hud-line text-[11px] tracking-widest text-zinc-500">
              <th className="p-2.5"><input type="checkbox" aria-label="Select all" checked={pageRows.length > 0 && pageRows.every((r) => sel.includes(r.id))} onChange={(e) => setSel(e.target.checked ? [...new Set([...sel, ...pageRows.map((r) => r.id)])] : sel.filter((i) => !pageRows.some((r) => r.id === i)))} /></th>
              {["PERSON", "COMPANY", ...(show.role ? ["ROLE"] : []), "EMAIL", "LINKEDIN", ...(show.job ? ["JOB"] : []), "STATUS", ...(show.source ? ["SOURCE"] : []), "ACTIONS"].map((h) => (
                <th key={h} className="p-2.5 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => {
              const cj = c.companies ? jobsByCompany.get(c.companies.id) ?? [] : [];
              const emailOk = c.email ? EMAIL_RE.test(c.email) : false;
              return (
                <tr key={c.id} className="border-b border-zinc-800/60 transition-colors hover:border-cyan-400/30 hover:bg-cyan-400/5">
                  <td className="p-2.5"><input type="checkbox" aria-label={`Select ${c.name}`} checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((i) => i !== c.id))} /></td>
                  <td className="p-2.5 font-semibold text-white">{c.name}</td>
                  <td className="p-2.5 text-zinc-300">{c.companies?.name ?? "—"}</td>
                  {show.role && <td className="p-2.5 text-zinc-400">
                    {c.role_title ?? <span className="text-zinc-600">Role not provided</span>}
                    <span className={`ml-1.5 rounded border px-1.5 py-0.5 text-[10px] font-bold ${CONTACT_TYPE_COLORS[c.contact_type ?? ""] ?? "os-hud-line text-zinc-400"}`}>
                      {c.contact_type ?? "OTHER"}
                    </span>
                  </td>}
                  <td className="p-2.5">
                    {c.email ? (
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono text-[13px] text-zinc-100">{c.email}</span>
                        {!emailOk && <span className="text-[10px] text-amber-300">CHECK EMAIL</span>}
                        <CopyBtn text={c.email} label="email" />
                      </span>
                    ) : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="p-2.5">
                    {c.linkedin_url ? (
                      <span className="flex items-center gap-1.5">
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="rounded border os-hud-line px-2 py-0.5 text-[11px] text-cyan-200 hover:bg-white/5">LinkedIn</a>
                        <CopyBtn text={c.linkedin_url} label="profile link" />
                      </span>
                    ) : <span className="text-zinc-600">—</span>}
                    {c.phone && (
                      <span className="mt-1 flex items-center gap-1.5">
                        <a
                          href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-400/20"
                        >
                          WHATSAPP
                        </a>
                      </span>
                    )}
                  </td>
                  {show.job && (
                    <td className="p-2.5 text-xs">
                      {cj.length === 0 ? <span className="text-zinc-600">—</span>
                        : cj.length === 1 ? <Link href={`/missions/${cj[0].id}`} className="text-cyan-300">{cj[0].title}</Link>
                        : <span className="text-zinc-300">{cj.length} Applications</span>}
                    </td>
                  )}
                  <td className="p-2.5">
                    <StatusBadge status={c.status} />
                  </td>
                  {show.source && (
                    <td className="max-w-40 truncate p-2.5 text-xs text-zinc-500" title={c.notes ?? ""}>
                      {sourceOf(c)}
                    </td>
                  )}
                  <td className="p-2.5">
                    <button onClick={() => { setView(c); setEditing(false); }} className="rounded border os-hud-line px-2 py-0.5 text-[11px] hover:bg-white/5">VIEW</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-zinc-400">No contacts match. Adjust search or filters.</p>}
      </div>

      {/* MOBILE CARDS */}
      <div className="flex flex-col gap-2 md:hidden">
        {pageRows.map((c) => (
          <details key={c.id} className="os-panel p-3">
            <summary className="cursor-pointer">
              <span className="font-bold text-white">{c.name.toUpperCase()}</span>
              <span className="block text-xs text-zinc-400">{c.role_title} • {c.companies?.name}</span>
            </summary>
            <div className="mt-2 flex flex-col gap-2 text-sm">
              {c.email && <span className="flex items-center gap-2 break-all font-mono text-[13px]">✉ {c.email} <CopyBtn text={c.email} label="email" /></span>}
              <span className="flex gap-2">
                {c.linkedin_url && <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="rounded border os-hud-line px-2.5 py-1 text-xs">LINKEDIN</a>}
                <button onClick={() => { setView(c); setEditing(false); }} className="rounded border os-hud-line px-2.5 py-1 text-xs">VIEW</button>
              </span>
              <span className="text-xs text-zinc-500">Status: {c.status ?? "NEW"} · Source: {sourceOf(c)}</span>
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs text-zinc-500">
        Showing {filtered.length === 0 ? 0 : page * PAGE + 1}–{Math.min(filtered.length, page * PAGE + PAGE)} of {filtered.length} contacts
        {totalPages > 1 && (
          <span className="ml-3">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="mr-2 underline disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="underline disabled:opacity-40">Next</button>
          </span>
        )}
      </p>

      {view && (
        <ContactModal
          contact={view}
          companies={companies}
          jobs={view.companies ? jobsByCompany.get(view.companies.id) ?? [] : []}
          onClose={() => setView(null)}
          onSaved={(u) => { setView(u); router.refresh(); }}
          onDeleted={() => { setView(null); router.refresh(); }}
        />
      )}
      <CelebrationHost queue={queue} onDone={() => { setQueue([]); router.refresh(); }} />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

function sourceOf(c: { notes: string | null }): string {
  const n = c.notes ?? "";
  if (/linkedin/i.test(n)) return "LinkedIn";
  if (/screenshot/i.test(n)) return "Screenshot";
  if (/post/i.test(n)) return "Job Post";
  if (/user/i.test(n)) return "User Added";
  return n ? "Notes" : "—";
}

function ContactModal({ contact: c0, companies, jobs, onClose, onSaved, onDeleted }: {
  contact: Contact; companies: { id: number; name: string }[];
  jobs: { id: number; title: string; mission_id: string }[];
  onClose: () => void; onSaved: (c: Contact) => void; onDeleted: () => void;
}) {
  const [c, setC] = useState(c0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: c0.name, role_title: c0.role_title ?? "", company_id: "",
    email: c0.email ?? "", phone: c0.phone ?? "", linkedin_url: c0.linkedin_url ?? "",
    contact_type: c0.contact_type ?? "OTHER", status: c0.status ?? "NEW", notes: c0.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (label: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label); setTimeout(() => setCopied(null), 1500);
    }).catch(() => alert("Copy failed."));
  };

  async function save() {
    setBusy(true);
    const res = await fetch("/api/contacts", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: c.id, name: form.name || c.name, role_title: form.role_title,
        company_id: form.company_id ? Number(form.company_id) : undefined,
        email: form.email, phone: form.phone, linkedin_url: form.linkedin_url,
        contact_type: form.contact_type, status: form.status, notes: form.notes,
      }),
    });
    setBusy(false);
    if (!res.ok) { alert("Save failed: " + (await res.json()).error); return; }
    setEditing(false);
    onSaved({ ...c, name: form.name || c.name, role_title: form.role_title || null, email: form.email || null, phone: form.phone || null, linkedin_url: form.linkedin_url || null, contact_type: form.contact_type, status: form.status, notes: form.notes || null });
  }
  async function del() {
    if (!confirm(`Delete ${c.name}? Jobs and companies stay.`)) return;
    await fetch(`/api/contacts?id=${c.id}`, { method: "DELETE" });
    onDeleted();
  }

  const F = "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={`Contact ${c.name}`}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="os-panel relative max-h-[92vh] w-full max-w-lg overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-display text-lg font-bold text-white">{c.name}</p>
            <p className="text-sm text-zinc-400">{c.role_title ?? "Role not provided"} · {companies.find((x) => x.id === (c.companies?.id))?.name ?? c.companies?.name}</p>
          </div>
          <button onClick={onClose} className="rounded border os-hud-line px-2.5 py-1 text-xs" aria-label="Close">✕ CLOSE</button>
        </div>
        {!editing ? (
          <div className="mt-3 flex flex-col gap-2.5 text-sm">
            <div>
              <p className="text-[11px] tracking-widest text-zinc-500">EMAIL</p>
              {c.email ? <p className="flex items-center gap-2 break-all font-mono text-[13px] text-zinc-100">{c.email}
                <button onClick={() => copy("email", c.email as string)} className="rounded border border-cyan-400/50 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-bold text-cyan-100">{copied === "email" ? "✓ COPIED" : "COPY EMAIL"}</button></p>
                : <p className="text-zinc-600">—</p>}
            </div>
            <div>
              <p className="text-[11px] tracking-widest text-zinc-500">PROFILE / LINKEDIN</p>
              {c.linkedin_url ? <p className="flex flex-wrap items-center gap-2 break-all text-[13px]">
                <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="text-cyan-200">OPEN PROFILE</a>
                <button onClick={() => copy("link", c.linkedin_url as string)} className="rounded border os-hud-line px-2 py-0.5 text-[11px]">{copied === "link" ? "✓ COPIED" : "COPY LINK"}</button>
              </p> : <p className="text-zinc-500">NOT AVAILABLE</p>}
            </div>
            <div>
              <p className="text-[11px] tracking-widest text-zinc-500">ASSOCIATED JOB</p>
              {jobs.length === 0 ? <p className="text-zinc-500">—</p> :
                jobs.map((j) => <Link key={j.id} href={`/missions/${j.id}`} className="mr-2 text-cyan-300">{j.title} ({j.mission_id})</Link>)}
            </div>
            <ConnectNote
              contactId={c.id}
              name={c.name}
              role={c.role_title}
              company={companies.find((x) => x.id === (c.companies?.id))?.name ?? c.companies?.name ?? ""}
              isPeer={!["HR", "RECRUITER", "HIRING MANAGER"].includes(c.contact_type ?? "")}
              phone={c.phone}
            />
            <div className="flex gap-4 text-sm">
              <span>Status: <strong className="text-white">{c.status ?? "NEW"}</strong></span>
              <span className="text-zinc-400">Source: {sourceOf(c)}</span>
            </div>
            {c.notes && <p className="text-xs text-zinc-500">{c.notes}</p>}
            {c.phone && <p className="text-xs text-zinc-400">Phone: {c.phone}</p>}
            <div className="mt-1 flex gap-2">
              <button onClick={() => setEditing(true)} className="rounded-md border os-hud-line px-3 py-1.5 text-xs font-bold">✎ EDIT</button>
              <button onClick={del} className="rounded-md border border-red-400/40 px-3 py-1.5 text-xs text-red-300">DELETE</button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" aria-label="Name" className={F} />
            <input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Role" aria-label="Role" className={F} />
            <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} aria-label="Company" className={F}>
              <option value="">Keep company</option>
              {companies.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" aria-label="Email" className={F} />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" aria-label="Phone" className={F} />
            <input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="LinkedIn URL (https://…)" aria-label="LinkedIn URL" className={F} />
            <div className="flex gap-2">
              <select value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} aria-label="Type" className={F}>
                {TYPES_MODAL.map((t) => <option key={t}>{t}</option>)}
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} aria-label="Status" className={F}>
                {STATUSES_MODAL.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes" aria-label="Notes" rows={2} className={F} />
            <div className="flex gap-2">
              <button onClick={save} disabled={busy} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-bold disabled:opacity-50">{busy ? "Saving…" : "SAVE"}</button>
              <button onClick={() => setEditing(false)} className="rounded-md border os-hud-line px-3 py-1.5 text-xs">CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TYPES_MODAL = ["HR","RECRUITER","HIRING MANAGER","EMPLOYEE","REFERRAL","FOUNDER","OTHER"];
const STATUSES_MODAL = ["NEW","CONTACTED","CONNECTED","RESPONDED","FOLLOW-UP","REFERRAL","NO RESPONSE","CLOSED"];

function AddForm({ companies, onDone }: { companies: { id: number; name: string }[]; onDone: () => void }) {
  const [form, setForm] = useState({ name: "", role_title: "", company_id: "", email: "", phone: "", linkedin_url: "", contact_type: "OTHER", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const F = "w-full rounded-md border os-hud-line bg-zinc-950 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400";
  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, company_id: form.company_id ? Number(form.company_id) : null }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json()).error); return; }
    onDone();
  }
  return (
    <div className="os-panel grid gap-2 p-3 sm:grid-cols-2">
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name *" aria-label="Name" className={F} />
      <input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} placeholder="Role" aria-label="Role" className={F} />
      <select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })} aria-label="Company" className={F}>
        <option value="">No company</option>
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })} aria-label="Type" className={F}>
        {TYPES_MODAL.map((t) => <option key={t}>{t}</option>)}
      </select>
      <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" aria-label="Email" className={F} />
      <input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="LinkedIn URL" aria-label="LinkedIn URL" className={F} />
      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" aria-label="Phone" className={`${F} sm:col-span-2`} />
      <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes / source" aria-label="Notes" rows={2} className={`${F} sm:col-span-2`} />
      {err && <p className="text-xs text-red-300 sm:col-span-2">{err}</p>}
      <div className="sm:col-span-2"><button onClick={save} disabled={busy} className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-bold disabled:opacity-50">{busy ? "Saving…" : "SAVE CONTACT"}</button></div>
    </div>
  );
}
