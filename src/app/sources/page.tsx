import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { kindFor, KIND_LABEL } from "@/lib/opportunities";
import { SectionTitle, EmptyState } from "@/components/ui";

// GET /sources — table-first view across every opportunity source.
// One row per mission: type, company, role, location, source, person, email,
// phone, date, status, mission link. URLs render as clickable labels.
export default async function SourcesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: jobs }, { data: contacts }, { data: apps }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,mission_id,title,location,source,source_type,job_url,linkedin_post_url,created_at,company_id,companies(name)")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("contacts").select("company_id,name,email,phone,linkedin_url"),
    supabase.from("applications").select("job_id,stage"),
  ]);
  const contactByCompany = new Map<number, { name: string; email: string | null; phone: string | null; linkedin_url: string | null }>();
  for (const c of contacts ?? []) {
    if (c.company_id != null && !contactByCompany.has(c.company_id))
      contactByCompany.set(c.company_id, c);
  }
  const stageByJob = new Map<number, string>();
  for (const a of apps ?? []) {
    if (a.job_id != null && !stageByJob.has(a.job_id))
      stageByJob.set(a.job_id, (a.stage ?? "").toUpperCase() || "—");
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionTitle kicker="REGISTRY" title="Opportunity sources" />
      {!jobs || jobs.length === 0 ? (
        <EmptyState
          title="NO SOURCES YET"
          body="Capture your first opportunity from Intake — it lands here automatically."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border os-hud-line">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b os-hud-line text-[11px] tracking-widest text-zinc-500">
                {["TYPE", "COMPANY", "ROLE", "LOCATION", "SOURCE", "PERSON", "EMAIL", "PHONE", "DATE", "STATUS", "MISSION", "LINKS"].map((h) => (
                  <th key={h} className="px-3 py-2 font-bold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(jobs ?? []).map((j) => {
                const co = j.companies as { name?: string } | null;
                const ct = j.company_id != null ? contactByCompany.get(j.company_id) : undefined;
                return (
                  <tr key={j.id} className="border-b border-white/5 align-top">
                    <td className="px-3 py-2">
                      <span className="rounded border border-cyan-400/30 bg-cyan-400/5 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-200">
                        {KIND_LABEL[kindFor(j.source_type, j.source)].toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold text-white">{co?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-200">{j.title}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{j.location ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{j.source ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">{ct?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {ct?.email ? (
                        <a href={`mailto:${ct.email}`} className="text-cyan-200 hover:text-white">{ct.email}</a>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-300">{ct?.phone ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-zinc-400">{String(j.created_at ?? "").slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-300">{stageByJob.get(j.id) ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <Link href={`/missions/${j.id}`} className="text-cyan-200 hover:text-white">
                        {j.mission_id ?? `#${j.id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                        {j.linkedin_post_url && (
                          <a href={j.linkedin_post_url} target="_blank" rel="noreferrer" className="rounded border os-hud-line px-1.5 py-0.5 text-zinc-300 hover:text-white">POST ↗</a>
                        )}
                        {j.job_url && (
                          <a href={j.job_url} target="_blank" rel="noreferrer" className="rounded border os-hud-line px-1.5 py-0.5 text-zinc-300 hover:text-white">JOB ↗</a>
                        )}
                        {ct?.linkedin_url && (
                          <a href={ct.linkedin_url} target="_blank" rel="noreferrer" className="rounded border os-hud-line px-1.5 py-0.5 text-zinc-300 hover:text-white">PROFILE ↗</a>
                        )}
                        {!j.linkedin_post_url && !j.job_url && !ct?.linkedin_url && (
                          <span className="text-zinc-600">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
