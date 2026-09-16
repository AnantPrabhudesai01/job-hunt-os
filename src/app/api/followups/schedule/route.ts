import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/followups/schedule — queue a nudge. Drafting + scheduling only;
// sending always happens outside (mailbox / wa.me / LinkedIn, manual).
const body = z.object({
  jobId: z.number().int(),
  contactName: z.string().trim().max(120).nullish(),
  channel: z.enum(["EMAIL", "WHATSAPP", "LINKEDIN", "PHONE"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).nullish(),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid follow-up." }, { status: 400 });
  const v = parsed.data;

  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", v.jobId)
    .eq("user_id", user.id)
    .single();
  if (!job) return NextResponse.json({ error: "Mission not found." }, { status: 404 });

  // One pending at a time; cap at 3 total nudges per mission — no spam.
  const { data: all } = await supabase
    .from("follow_ups")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("job_id", v.jobId);
  if ((all ?? []).length >= 3)
    return NextResponse.json({ ok: false, error: "Follow-up cap reached (3 per mission). No more auto-nudges." }, { status: 409 });
  if ((all ?? []).some((r) => r.status === "PENDING"))
    return NextResponse.json({ ok: true, reused: true, id: (all ?? []).find((r) => r.status === "PENDING")!.id });

  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      user_id: user.id,
      job_id: v.jobId,
      contact_name: v.contactName?.trim() || null,
      channel: v.channel,
      due_date: v.dueDate,
      status: "PENDING",
      notes: v.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data)
    return NextResponse.json({ error: error?.message ?? "Schedule failed." }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
