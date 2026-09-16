import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/outreach/update — move one HR row along the pipeline, save the
// connect note (LinkedIn caps notes at 300 chars — enforced here, not just UI)
// or the follow-up message draft, link a mission. Sending stays manual.

const payload = z.object({
  id: z.number().int().positive(),
  status: z.enum(["SAVED", "VISITED", "NOTE_SENT", "CONNECTED", "MESSAGED", "REPLIED"]).nullish(),
  connect_note: z.string().trim().max(300).nullish(),
  message_draft: z.string().trim().max(2000).nullish(),
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
  const { id, status, connect_note, message_draft, mission_job_id } = parsed.data;
  const patch: Record<string, unknown> = {};
  if (connect_note !== undefined) patch.connect_note = connect_note || null;
  if (message_draft !== undefined) patch.message_draft = message_draft || null;
  if (mission_job_id !== undefined) patch.mission_job_id = mission_job_id;
  if (status) {
    patch.status = status;
    const now = new Date().toISOString();
    if (status === "VISITED") patch.visited_at = now;
    if (status === "CONNECTED") patch.connected_at = now;
    if (status === "MESSAGED") patch.messaged_at = now;
  }
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { error } = await supabase
    .from("hr_outreach")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update." }, { status: 500 });
  // Per-contact follow-up auto-nudge: NOTE_SENT arms a +4d reminder (mission nudges already exist).
  // One pending per contact+mission; manual sends stay manual, this just queues the reminder.
  if (status === "NOTE_SENT") {
    const { data: row } = await supabase
      .from("hr_outreach")
      .select("person_name,company_name,mission_job_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    const jid = (row as { mission_job_id?: number | null } | null)?.mission_job_id ?? null;
    if (jid) {
      const due = new Date();
      due.setDate(due.getDate() + 4);
      const dueStr = due.toISOString().slice(0, 10);
      const who = (row as { person_name?: string | null; company_name?: string | null } | null)?.person_name ?? "contact";
      const comp = (row as { company_name?: string | null } | null)?.company_name ?? "";
      const { data: all } = await supabase
        .from("follow_ups")
        .select("id,status")
        .eq("user_id", user.id)
        .eq("job_id", jid);
      if ((all ?? []).length >= 3) {
        // Cap reached — no more auto-nudges for this mission, avoid spam.
      } else if (!(all ?? []).some((r) => r.status === "PENDING")) {
        await supabase.from("follow_ups").insert({
          user_id: user.id,
          job_id: jid,
          contact_name: who,
          channel: "LINKEDIN",
          due_date: dueStr,
          status: "PENDING",
          notes: `Per-contact nudge: ${who}${comp ? ` @ ${comp}` : ""} — note sent, ping in 4d if no reply (auto, capped 3/mission).`,
        });
      }
    }
  }
  return NextResponse.json({ ok: true });
}
