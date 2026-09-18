import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";

// /directory — long-term switching network, not the hunt board.
// Company cards: LinkedIn + website + mail + location, each with its
// people (HR name/role/LinkedIn/phone/mail, last contact) and linked
// missions. Entries are added via chat (agent stores links verbatim,
// directory-only — no mission, no status flip). Read-only by design.
export default async function DirectoryPage({
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
    .select(
      "id,name,website,location,industry,contact_email,company_linkedin,notes,jobs(id,mission_id,title,status),contacts(id,name,role_title,email,phone,linkedin_url,last_contacted)",
    )
    .order("name");
  if (q)
    query = query.ilike("name", `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
  const { data: companies } = await query;

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle
          kicker="NETWORK"
          title={`Directory (${(companies ?? []).length})`}
        />
        <form method="get" className="mb-3 flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search companies…"
            maxLength={80}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold hover:bg-sky-500"
          >
            Search
          </button>
        </form>
        {q && (
          <p className="mb-3 rounded-lg border border-cyan-400/30 bg-cyan-400/5 p-2.5 text-sm text-zinc-300">
            Filtered by “{q}” — {(companies ?? []).length} match
            {(companies ?? []).length === 1 ? "" : "es"}.{" "}
            <Link href="/directory" className="font-bold text-cyan-300">
              Clear →
            </Link>
          </p>
        )}
        {!companies || companies.length === 0 ? (
          <EmptyState
            title="EMPTY DIRECTORY"
            body="No companies stored yet. Send me a company LinkedIn link plus HR links in chat and I file them here — no mission needed."
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {companies.map((c) => {
              const jobs = (c.jobs ?? []) as {
                id: number;
                mission_id: string | null;
                title: string;
                status: string | null;
              }[];
              const people = (c.contacts ?? []) as {
                id: number;
                name: string;
                role_title: string | null;
                email: string | null;
                phone: string | null;
                linkedin_url: string | null;
                last_contacted: string | null;
              }[];
              return (
                <li key={c.id} className="card-hover os-panel p-4">
                  <p className="font-display font-bold text-white">{c.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {[c.industry, c.location].filter(Boolean).join(" · ") ||
                      "details awaited"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {c.company_linkedin ? (
                      <a
                        href={c.company_linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-sky-400/40 bg-sky-400/10 px-2 py-1 font-semibold text-sky-200"
                      >
                        Company LinkedIn →
                      </a>
                    ) : (
                      <span className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-500">
                        Company LinkedIn: share it with me
                      </span>
                    )}
                    {c.website ? (
                      <a
                        href={
                          c.website.startsWith("http")
                            ? c.website
                            : `https://${c.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300"
                      >
                        Website →
                      </a>
                    ) : null}
                    {c.contact_email ? (
                      <a
                        href={`mailto:${c.contact_email}`}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-zinc-300"
                      >
                        {c.contact_email}
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-3">
                    <p className="text-[11px] font-bold tracking-widest text-zinc-500">
                      PEOPLE ({people.length})
                    </p>
                    {people.length === 0 ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        No people filed — send HR links and I attach them here.
                      </p>
                    ) : (
                      <ul className="mt-1 flex flex-col gap-1.5">
                        {people.map((p) => (
                          <li
                            key={p.id}
                            className="rounded-lg border border-white/5 bg-white/[0.02] p-2 text-xs"
                          >
                            <span className="font-semibold text-zinc-100">
                              {p.name}
                            </span>
                            {p.role_title ? (
                              <span className="text-zinc-400">
                                {" "}
                                · {p.role_title}
                              </span>
                            ) : null}
                            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-400">
                              {p.linkedin_url ? (
                                <a
                                  href={p.linkedin_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sky-300"
                                >
                                  LinkedIn →
                                </a>
                              ) : null}
                              {p.email ? (
                                <a href={`mailto:${p.email}`}>{p.email}</a>
                              ) : null}
                              {p.phone ? (
                                <a
                                  href={`tel:${p.phone.replace(/\D/g, "")}`}
                                  className="font-mono"
                                >
                                  {p.phone}
                                </a>
                              ) : null}
                              {p.last_contacted ? (
                                <span>
                                  last contact {String(p.last_contacted).slice(0, 10)}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {jobs.length > 0 && (
                    <p className="mt-2 text-xs text-zinc-500">
                      Missions:{" "}
                      {jobs.map((j) => (
                        <Link
                          key={j.id}
                          href={`/missions/${j.id}`}
                          className="mr-2 text-cyan-200"
                        >
                          {j.mission_id ?? `#${j.id}`} ↗
                        </Link>
                      ))}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
