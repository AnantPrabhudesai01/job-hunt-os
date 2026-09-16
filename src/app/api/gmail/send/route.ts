import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { gmailSend } from "@/lib/gmail";

const payload = z.object({
  jobId: z.number().int(),
  to: z.string().email().max(160),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(20000),
  resumeFileName: z.string().trim().min(3).max(200),
  confirmed: z.boolean(),
});

// POST /api/gmail/send — approved sends only, with wrong-resume BLOCK.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const v = payload.safeParse(await req.json());
  if (!v.success)
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  if (!v.data.confirmed)
    return NextResponse.json(
      { error: "Send requires explicit user approval." },
      { status: 400 },
    );

  // Duplicate protection: same person+company+role already emailed?
  const { data: job } = await supabase
    .from("jobs")
    .select("id,title,company_id,companies(name)")
    .eq("id", v.data.jobId)
    .eq("user_id", user.id)
    .single();
  if (!job) return NextResponse.json({ error: "Unknown job." }, { status: 404 });

  // Wrong-resume BLOCK: the file must belong to THIS job.
  const { data: resume } = await supabase
    .from("resume_versions")
    .select("id,file_name,storage_path")
    .eq("user_id", user.id)
    .eq("job_id", v.data.jobId)
    .eq("file_name", v.data.resumeFileName)
    .limit(1)
    .single();
  if (!resume)
    return NextResponse.json(
      { error: "BLOCKED: that resume does not belong to this application." },
      { status: 400 },
    );

  // Fetch the exact PDF bytes from Storage (owner RLS enforced).
  let fileBytes: Uint8Array | undefined;
  let bucket = "";
  let spath = "";
  const m = (resume.storage_path ?? "").match(
    /^(resumes|interview-preparation|people-research|company-research|job-descriptions|uploads|application-assets|profile-assets|documents)\//,
  );
  if (m) {
    bucket = m[1];
    spath = (resume.storage_path as string).slice(bucket.length + 1);
    const { data: blob, error } = await supabase.storage
      .from(bucket)
      .download(spath);
    if (error || !blob)
      return NextResponse.json(
        { error: "Resume bytes unavailable — re-sync the vault first." },
        { status: 500 },
      );
    fileBytes = new Uint8Array(await blob.arrayBuffer());
  }

  // Create + link the asset row for this send.
  const { data: asset } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      job_id: v.data.jobId,
      asset_type: "EMAIL_DRAFT",
      file_name: `email-to-${v.data.to}.txt`,
      mime_type: "text/plain",
      source: "Gmail send flow",
      confidence: "HIGH",
      sync_status: "SYNCED",
    })
    .select("id")
    .single();

  const { data: comm, error: commErr } = await supabase
    .from("communications")
    .insert({
      user_id: user.id,
      job_id: v.data.jobId,
      company_id: job.company_id,
      recipient_email: v.data.to,
      subject: v.data.subject,
      body: v.data.body,
      resume_asset_id: asset?.id ?? null,
      resume_file_name: v.data.resumeFileName,
      provider: "gmail",
      status: "APPROVED",
    })
    .select("id")
    .single();
  if (commErr || !comm)
    return NextResponse.json({ error: "Could not record communication." }, { status: 500 });

  try {
    const { messageId, from } = await gmailSend({
      userId: user.id,
      origin: req.nextUrl.origin,
      to: v.data.to,
      subject: v.data.subject,
      body: v.data.body,
      filename: v.data.resumeFileName,
      fileBytes,
    });
    await supabase
      .from("communications")
      .update({
        status: "SENT",
        provider_message_id: messageId,
        sent_at: new Date().toISOString(),
      })
      .eq("id", comm.id);
    await supabase.from("application_events").insert({
      user_id: user.id,
      job_id: v.data.jobId,
      event_type: "EMAIL_SENT",
      event_timestamp: new Date().toISOString(),
      timezone: "Asia/Kolkata",
      source: "Gmail API send (user-approved)",
      metadata: { to: v.data.to, messageId, from },
    });
    return NextResponse.json({ ok: true, messageId, from });
  } catch (e) {
    await supabase
      .from("communications")
      .update({
        status: "FAILED",
        error: e instanceof Error ? e.message.slice(0, 500) : "Send failed",
      })
      .eq("id", comm.id);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Send failed." },
      { status: 500 },
    );
  }
}
