import { redirect } from "next/navigation";
import Link from "next/link";
import { Map as MapIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getMissions } from "@/lib/data";
import { statusColor } from "@/lib/game";
import { SectionTitle, EmptyState } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { TerritoryMap } from "./territory-map";

// Territories: missions grouped by normalized location. Counts and best
// stage per territory, all from real rows. Positive-only conquest display.
export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const missions = await getMissions();
  const groups = new Map<string, typeof missions>();
  for (const m of missions) {
    const key = (m.location ?? "Unknown territory").trim().toLowerCase().replace(/\s+/g, " ");
    const label = key
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(m);
  }
  const lands = [...groups.entries()]
    .map(([label, ms]) => ({
      label,
      total: ms.length,
      applied: ms.filter((m) =>
        ["APPLIED", "OUTREACH", "WAITING", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER"].includes(
          (m.applications[0]?.stage ?? m.status ?? "").toUpperCase(),
        ),
      ).length,
      sample: ms.slice(0, 3),
      rest: ms.length - Math.min(ms.length, 3),
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="flex flex-col gap-4">
      <Reveal>
        <SectionTitle kicker="WORLD ATLAS" title={`Territories — ${lands.length} fronts`} />
        <div className="mt-3">
          <TerritoryMap pins={lands.map((l) => ({ label: l.label, total: l.total, applied: l.applied }))} />
        </div>
      </Reveal>
      <Reveal>
        {lands.length === 0 ? (
          <EmptyState title="UNEXPLORED WORLD" body="No missions yet. Discover the first opportunity to claim territory." />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lands.map((l) => (
              <li key={l.label} className="os-panel p-4">
                <p className="font-display flex items-center gap-2 font-bold text-white">
                  <MapIcon size={15} className="text-cyan-300" aria-hidden />
                  {l.label}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
                  <div
                    className="grad-xp h-full rounded-full"
                    style={{ width: `${l.total === 0 ? 0 : Math.round((l.applied / l.total) * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-zinc-400">
                  {l.applied}/{l.total} engaged
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {l.sample.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 text-xs">
                      <Link href={`/missions/${m.id}`} className="truncate text-zinc-200 hover:text-white">
                        {m.mission_id} · {m.title}
                      </Link>
                      <span className={`shrink-0 rounded border px-1.5 py-px text-[10px] ${statusColor(m.applications[0]?.stage ?? m.status)}`}>
                        {m.applications[0]?.stage ?? m.status ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
                {l.rest > 0 && <p className="mt-1 text-[11px] text-zinc-500">+{l.rest} more in this territory</p>}
              </li>
            ))}
          </ul>
        )}
      </Reveal>
    </div>
  );
}
