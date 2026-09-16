import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle, EmptyState } from "@/components/ui";
import { OutreachClient, type HrRow } from "./outreach-client";

// GET /outreach — HR/hiring-manager pipeline. Bulk-paste LinkedIn profiles,
// dedupe by profile URL, draft ≤300-char connect notes + follow-up messages,
// track SAVED → VISITED → NOTE_SENT → CONNECTED → MESSAGED → REPLIED.
// Sending/connecting stays manual — this page prepares + records.
export default async function OutreachPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let rows: HrRow[] = [];
  let setupNeeded = false;
  try {
    const { data, error } = await supabase
      .from("hr_outreach")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) setupNeeded = true;
    else rows = (data ?? []) as HrRow[];
  } catch {
    setupNeeded = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <SectionTitle kicker="NETWORK OFFENSIVE" title="HR outreach" />
        <Link href="/intake" className="btn btn-primary shrink-0 text-xs">
          + INTAKE
        </Link>
      </div>
      {setupNeeded ? (
        <section className="os-panel p-5">
          <SectionTitle kicker="SETUP" title="One-time database step" />
          <p className="mt-2 text-sm text-zinc-300">
            This pipeline needs its table. In Supabase Dashboard → SQL Editor, paste and
            run <span className="font-mono">supabase/migration_016.sql</span> once, then reload.
          </p>
        </section>
      ) : rows.length === 0 ? (
        <EmptyState
          title="NO HR PROFILES YET"
          body="Paste 50–100 LinkedIn profile links below. Duplicates are caught — visited profiles are never stored twice."
        />
      ) : null}
      {!setupNeeded && <OutreachClient initial={rows} />}
    </div>
  );
}
