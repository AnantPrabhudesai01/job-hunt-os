import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const q = ((await searchParams)?.q ?? "").trim().slice(0, 80);
  let query = supabase
    .from("companies")
    .select("id,name,location,industry,jobs(id,status)")
    .order("name");
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
  const { data: companies } = await query;

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="INTELLIGENCE" title="Target factions" />
        {q && (
          <p className="mb-3 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2.5 text-sm text-zinc-300">
            Filtered by “{q}” — {(companies ?? []).length} match{(companies ?? []).length === 1 ? "" : "es"}.{" "}
            <Link href="/companies" className="font-bold text-cyan-300">
              Clear →
            </Link>
          </p>
        )}
        {!companies || companies.length === 0 ? (
          <EmptyState
            title="NO TARGETS"
            body="No companies tracked yet. Companies appear here as missions are created."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {companies.map((c) => {
              const jobs = (c.jobs ?? []) as { id: number; status: string | null }[];
              const engaged = jobs.some((j) =>
                ["APPLIED", "OUTREACH", "WAITING", "INTERVIEW"].includes(
                  (j.status ?? "").toUpperCase(),
                ),
              );
              return (
                <li key={c.id} className="card-hover os-panel p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display font-bold text-white">{c.name}</p>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        engaged
                          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                          : "border-cyan-400/40 bg-cyan-400/10 text-cyan-200"
                      }`}
                    >
                      {engaged ? "ENGAGED" : "TARGET"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">
                    {[c.industry, c.location].filter(Boolean).join(" · ") ||
                      "Sector unknown"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {jobs.length} mission{jobs.length === 1 ? "" : "s"}
                    {jobs[0] && (
                      <>
                        {" · "}
                        <Link
                          href={`/missions/${jobs[0].id}`}
                          className="text-cyan-300"
                        >
                          Open →
                        </Link>
                      </>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
