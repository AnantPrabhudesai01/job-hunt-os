"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { APP_STATUSES } from "@/lib/game";
import { MILESTONES, milestoneId } from "@/lib/gamification";

const payload = z.object({
  jobId: z.number().int(),
  status: z.enum(APP_STATUSES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  method: z.string().trim().max(40).nullish(),
  emailUsed: z.string().trim().max(160).nullish(),
  resumeUsed: z.string().trim().max(200).nullish(),
  confirmedApplied: z.boolean().nullish(),
});

// Only the user, via explicit confirmation, can set APPLIED.
export async function setApplicationStatus(input: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  const v = payload.parse(input);

  const { data: app } = await supabase
    .from("applications")
    .select("id,stage")
    .eq("user_id", user.id)
    .eq("job_id", v.jobId)
    .single();
  if (!app) throw new Error("Application record not found.");

  if (v.status === "APPLIED" && app.stage !== "APPLIED" && !v.confirmedApplied) {
    throw new Error("Confirm that you actually submitted it first.");
  }
  const appliedAt =
    v.status === "APPLIED" ? (v.date ?? new Date().toISOString().slice(0, 10)) : null;

  const { error } = await supabase
    .from("applications")
    .update({
      stage: v.status,
      date_applied: appliedAt,
      applied_at: v.status === "APPLIED" ? `${appliedAt}T00:00:00+05:30` : null,
      applied_method: v.status === "APPLIED" ? (v.method || null) : null,
      email_used: v.status === "APPLIED" ? (v.emailUsed || null) : null,
      resume_used: v.status === "APPLIED" ? (v.resumeUsed || null) : null,
    })
    .eq("id", app.id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await supabase.from("jobs").update({
    status: v.status,
    status_changed_at: new Date().toISOString(),
    applied_at: v.status === "APPLIED" ? `${appliedAt}T00:00:00+05:30` : null,
  }).eq("id", v.jobId).eq("user_id", user.id);

  await supabase.from("application_events").insert({
    user_id: user.id,
    job_id: v.jobId,
    event_type: "STATUS_CHANGED",
    event_timestamp: new Date().toISOString(),
    timezone: "Asia/Kolkata",
    source: "Manual status control (user)",
    metadata: { from: app.stage, to: v.status, method: v.method ?? null },
  });

  // Real-time reward: first transition into APPLIED pays XP once.
  let xpAwarded = 0;
  if (v.status === "APPLIED" && app.stage !== "APPLIED") {
    const { data: job } = await supabase
      .from("jobs")
      .select("mission_id")
      .eq("id", v.jobId)
      .eq("user_id", user.id)
      .single();
    await supabase.from("xp_transactions").insert({
      user_id: user.id,
      mission_id: job?.mission_id ?? null,
      action: "Application submitted",
      xp: 30,
    });
    xpAwarded = 30;

    // Daily-target milestones (25/50/75/100 APPLIED flips in the applied day).
    // Award-once via PK; missed milestones simply stay unearned — never punitive.
    if (appliedAt) {
      const { count } = await supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("stage", "APPLIED")
        .eq("date_applied", appliedAt);
      const today = count ?? 0;
      for (const m of MILESTONES) {
        if (today < m.at) continue;
        const mid = milestoneId(appliedAt, m.at);
        const { data: inserted } = await supabase
          .from("user_achievements")
          .insert({ user_id: user.id, achievement_id: mid, xp_awarded: m.xp, celebration_seen: false })
          .select("achievement_id");
        if (inserted && inserted.length > 0) {
          await supabase.from("xp_transactions").insert({
            user_id: user.id,
            action: `Target milestone: ${m.at} applied (${appliedAt})`,
            xp: m.xp,
          });
          xpAwarded += m.xp;
        }
      }
    }
    // Standing rule (2026-09-09): every APPLIED flip auto-queues the first
    // nudge — due 4 days after the applied date, contact auto-filled.
    // One pending per mission (reuse check); the queue suggests the rest.
    if (appliedAt) {
      const { data: pending } = await supabase
        .from("follow_ups")
        .select("id")
        .eq("user_id", user.id)
        .eq("job_id", v.jobId)
        .eq("status", "PENDING")
        .limit(1);
      if (!pending || pending.length === 0) {
        const { data: jobRow } = await supabase
          .from("jobs")
          .select("company_id")
          .eq("id", v.jobId)
          .eq("user_id", user.id)
          .single();
        let contactName: string | null = null;
        if (jobRow?.company_id) {
          const { data: ct } = await supabase
            .from("contacts")
            .select("name")
            .eq("user_id", user.id)
            .eq("company_id", jobRow.company_id)
            .order("id")
            .limit(1);
          contactName = ct?.[0]?.name ?? null;
        }
        const due = new Date(`${appliedAt}T00:00:00Z`);
        due.setUTCDate(due.getUTCDate() + 4);
        await supabase.from("follow_ups").insert({
          user_id: user.id,
          job_id: v.jobId,
          contact_name: contactName,
          channel: "EMAIL",
          due_date: due.toISOString().slice(0, 10),
          status: "PENDING",
          notes: "Auto-queued on APPLIED (manager rule: first nudge 4 days out).",
        });
      }
    }
  }
  return { ok: true as const, xpAwarded };
}
