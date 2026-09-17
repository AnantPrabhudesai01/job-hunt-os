import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// POST /api/calls/log — record what happened on YOUR call (you dial, the app
// remembers). {jobId, contactName?, outcome, callbackDate?, interviewNote?,
// noAnswer?}
// - Always: communications row (PHONE / CALLED) + XP (10 first call per
//   mission, 5 after — idempotent via existing-call check).
// - callbackDate ("call me back <day>"): auto-queues a PHONE nudge.
// - noAnswer (or outcome reads like one): auto-queues a retry for tomorrow.
// - interviewNote ("interview Tue 11am"): rides in the nudge note so the
//   reminder carries the appointment. Times live in notes (no schema change).
const body = z.object({
  jobId: z.number().int(),
  contactName: z.string().trim().max(120).nullish(),
  outcome: z.string().trim().min(3).max(2000),
  callbackDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  interviewNote: z.string().trim().max(300).nullish(),
  noAnswer: z.boolean().nullish(),
});

const NO_ANSWER_RE = /not?\s*(pick|answer|lift|respond)|didn.?t\s*(pick|answer)|no\s*(answer|response|reply)|switched off|unreachab|busy|call (back|later)|try (again|later)/i;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Outcome text required." }, { status: 400 });
  const v = parsed.data;

  const { data: job } = await supabase
    .from("jobs")
    .select("id,company_id")
    .eq("id", v.jobId)
    .eq("user_id", user.id)
    .single();
  if (!job) return NextResponse.json({ error: "Mission not found." }, { status: 404 });

  const { error } = await supabase.from("communications").insert({
    user_id: user.id,
    job_id: v.jobId,
    company_id: job.company_id,
    channel: "PHONE",
    status: "CALLED",
    // communications table stores free text in `body` (there is no `notes` column).
    body: `Call outcome (${v.contactName?.trim() || "unknown contact"}): ${v.outcome.trim()}${
      v.interviewNote?.trim() ? ` | INTERVIEW: ${v.interviewNote.trim()}` : ""
    }`,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let queued: string | null = null;
  const dueWanted = v.callbackDate ?? null;
  const unanswered = Boolean(v.noAnswer) || NO_ANSWER_RE.test(v.outcome);
  // No-answer with no explicit date = retry tomorrow, manager's call.
  let autoDue = dueWanted;
  if (!autoDue && unanswered) {
    const t = new Date();
    t.setUTCDate(t.getUTCDate() + 1);
    autoDue = t.toISOString().slice(0, 10);
  }
  if (autoDue) {
    const { data: existing } = await supabase
      .from("follow_ups")
      .select("id")
      .eq("user_id", user.id)
      .eq("job_id", v.jobId)
      .eq("status", "PENDING")
      .limit(1);
    if (!existing || existing.length === 0) {
      await supabase.from("follow_ups").insert({
        user_id: user.id,
        job_id: v.jobId,
        contact_name: v.contactName?.trim() || null,
        channel: "PHONE",
        due_date: autoDue,
        status: "PENDING",
        notes: `${unanswered && !dueWanted ? "No answer — auto retry. " : ""}${
          dueWanted ? "Callback promised on call. " : ""
        }Outcome: ${v.outcome.trim().slice(0, 200)}${
          v.interviewNote?.trim() ? ` | INTERVIEW: ${v.interviewNote.trim()}` : ""
        }`,
      });
      queued = autoDue;
    } else {
      queued = "already-queued";
    }
  }

  const { count: priorCalls } = await supabase
    .from("communications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("job_id", v.jobId)
    .eq("channel", "PHONE");
  const xp = (priorCalls ?? 0) <= 1 ? 10 : 5; // first logged call per mission pays double
  await supabase.from("xp_transactions").insert({
    user_id: user.id,
    action: (priorCalls ?? 0) <= 1 ? "First call logged (manual)" : "Call logged (manual)",
    xp,
  });
  return NextResponse.json({ ok: true, xp, callbackQueued: queued, autoRetry: unanswered && !dueWanted });
}
