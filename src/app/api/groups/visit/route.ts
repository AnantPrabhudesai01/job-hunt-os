import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/groups/visit — mark a captured post VISITED (seen, skip) or
// INGESTED (turned into a mission; mission_job_id links the mission row).

const payload = z.object({
  id: z.number().int().positive(),
  status: z.enum(["VISITED", "INGESTED"]),
  mission_job_id: z.number().int().positive().nullish(),
});

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = payload.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  const { id, status, mission_job_id } = parsed.data;
  const { error } = await supabase
    .from("group_posts")
    .update({ status, mission_job_id: mission_job_id ?? null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
