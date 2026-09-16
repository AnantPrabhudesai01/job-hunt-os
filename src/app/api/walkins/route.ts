import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// GET /api/walkins — upcoming walk-in missions (from stored posting text) plus
// YOUR saved field reports. POST upserts one report per mission.
// Statuses never change from here; this is notes-only territory.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: missions }, { data: reports }] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,mission_id,title,location,deadline,employment_type,companies(name)")
      .eq("user_id", user.id)
      .or("description.ilike.%walk-in%,employment_type.ilike.%walk-in%")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from("walkin_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("visited_date", { ascending: false, nullsFirst: false }),
  ]);
  return NextResponse.json({ missions: missions ?? [], reports: reports ?? [] });
}

const payload = z.object({
  mission_job_id: z.number().int().positive(),
  attended: z.boolean().nullish(),
  visited_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  rounds: z.string().trim().max(2000).nullish(),
  questions_asked: z.string().trim().max(4000).nullish(),
  crowd_notes: z.string().trim().max(2000).nullish(),
  outcome: z
    .enum(["UPCOMING", "ATTENDED", "SHORTLISTED", "REJECTED", "WAITING", "SKIPPED"])
    .nullish(),
  rating: z.number().int().min(1).max(5).nullish(),
  notes: z.string().trim().max(4000).nullish(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = payload.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const d = parsed.data;
  const row = {
    user_id: user.id,
    mission_job_id: d.mission_job_id,
    attended: d.attended ?? false,
    visited_date: d.visited_date || null,
    rounds: d.rounds || null,
    questions_asked: d.questions_asked || null,
    crowd_notes: d.crowd_notes || null,
    outcome: d.outcome ?? "UPCOMING",
    rating: d.rating ?? null,
    notes: d.notes || null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("walkin_reports")
    .upsert(row, { onConflict: "user_id,mission_job_id" });
  if (error) {
    const missing = error.message?.includes("walkin_reports");
    return NextResponse.json(
      { error: missing ? "Table missing — paste supabase/migration_017.sql once first." : "Could not save." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
