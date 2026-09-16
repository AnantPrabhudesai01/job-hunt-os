import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/outreach/log — manual-channel bookkeeping only.
// { jobId, channel: WHATSAPP|LINKEDIN, action, contactId?, body? }
// Actions: WA_OPENED, WA_SENT_MANUAL, LI_COPIED, LI_OPENED, LI_SENT_MANUAL.
// Never invents a send; only records what the user confirms.
const payload = z.object({
  jobId: z.number().int(),
  channel: z.enum(["WHATSAPP", "LINKEDIN"]),
  action: z.enum(["WA_OPENED", "WA_SENT_MANUAL", "LI_COPIED", "LI_OPENED", "LI_SENT_MANUAL"]),
  contactId: z.number().int().nullish(),
  body: z.string().max(2000).nullish(),
});

const STATUS_FOR: Record<string, string> = {
  WA_OPENED: "WHATSAPP OPENED",
  WA_SENT_MANUAL: "SENT MANUALLY",
  LI_COPIED: "NOTE COPIED",
  LI_OPENED: "PROFILE OPENED",
  LI_SENT_MANUAL: "SENT MANUALLY",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const v = payload.safeParse(await req.json());
  if (!v.success) return NextResponse.json({ error: "Invalid payload." }, { status: 400 });

  const { data: job } = await supabase
    .from("jobs")
    .select("id,company_id")
    .eq("id", v.data.jobId)
    .eq("user_id", user.id)
    .single();
  if (!job) return NextResponse.json({ error: "Unknown job." }, { status: 404 });

  // Reuse the open row for this job+channel+contact, else create.
  let q = supabase
    .from("communications")
    .select("id")
    .eq("user_id", user.id)
    .eq("job_id", v.data.jobId)
    .eq("channel", v.data.channel)
    .not("status", "in", "(SENT,SENT MANUALLY)")
    .order("id", { ascending: false })
    .limit(1);
  if (v.data.contactId) q = q.eq("contact_id", v.data.contactId);
  const { data: existing } = await q.single();

  const patch: { status: string; sent_at?: string } = {
    status: STATUS_FOR[v.data.action],
    ...(v.data.action === "WA_SENT_MANUAL" || v.data.action === "LI_SENT_MANUAL"
      ? { sent_at: new Date().toISOString() }
      : {}),
  };
  if (existing) {
    const upd: Record<string, unknown> = { ...patch };
    if (v.data.body) upd.body = v.data.body;
    await supabase.from("communications").update(upd).eq("id", existing.id);
    return NextResponse.json({ ok: true, id: existing.id });
  }
  const { data: created, error } = await supabase
    .from("communications")
    .insert({
      user_id: user.id,
      job_id: v.data.jobId,
      company_id: job.company_id,
      contact_id: v.data.contactId ?? null,
      channel: v.data.channel,
      body: v.data.body ?? null,
      ...patch,
    })
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: created.id });
}
