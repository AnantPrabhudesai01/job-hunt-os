import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RARITY_STYLE, rarityForResume } from "@/lib/gamification";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";

export default async function ResumesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: resumes } = await supabase
    .from("resume_versions")
    .select("id,file_name,version_label,has_photo,storage_path,notes,jobs(mission_id,title,companies(name))")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="LOADOUT BAY" title="Resume loadouts" />
        {!resumes || resumes.length === 0 ? (
          <EmptyState
            title="LOADOUT EMPTY"
            body="No tailored resumes stored yet. Each tailored resume becomes a loadout here."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {resumes.map((r) => {
              const job = r.jobs as unknown as {
                mission_id: string;
                title: string;
                companies: { name?: string } | null;
              } | null;
              const rarity = rarityForResume(r.file_name ?? "");
              return (
                <li key={r.id} className="card-hover os-panel p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-white">
                      {job?.companies?.name} · {job?.title}
                    </p>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span
                        title={rarity.why}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${RARITY_STYLE[rarity.tier]}`}
                      >
                        {rarity.tier}
                      </span>
                    {r.has_photo && (
                      <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[11px] font-bold text-violet-200">
                        PHOTO
                      </span>
                    )}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-zinc-400">
                    {r.file_name} · {r.version_label} · {job?.mission_id}
                  </p>
                  {r.notes && (
                    <p className="mt-1 text-xs text-zinc-500">{r.notes}</p>
                  )}
                  <div className="mt-2">
                    {r.storage_path ? (
                      <a
                        href={`/api/vault/download?path=${encodeURIComponent(r.storage_path)}`}
                        className="inline-block rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold hover:bg-sky-500"
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="inline-block rounded-md border border-dashed os-hud-line px-2.5 py-1 text-xs text-zinc-500">
                        Local copy only — cloud sync pending
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
