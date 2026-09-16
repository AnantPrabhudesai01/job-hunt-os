import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";

// GET /api/export/package?jobId= — application package ZIP built from Supabase
// (DB rows + Storage bytes the owner can read). Nothing from local disk.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const jobId = Number(req.nextUrl.searchParams.get("jobId"));
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const { data: job } = await supabase
    .from("jobs")
    .select("*, companies(name)")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .single();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [{ data: docs }, { data: drafts }, { data: contacts }, { data: apps }] =
    await Promise.all([
      supabase.from("documents").select("*").eq("user_id", user.id).eq("job_id", jobId),
      supabase.from("email_drafts").select("*").eq("user_id", user.id).eq("job_id", jobId),
      supabase.from("contacts").select("name,role_title,contact_type,email,phone,linkedin_url,notes").eq("user_id", user.id),
      supabase.from("applications").select("stage,date_applied,applied_method,email_used,resume_used").eq("user_id", user.id).eq("job_id", jobId),
    ]);

  const zip = new JSZip();
  const company = ((job.companies as { name?: string } | null)?.name ?? "Company").replace(/[^\w\- ]+/g, "").trim();
  const root = zip.folder(`${company} - ${job.title}`)!;

  // Summary (facts only)
  const app = (apps ?? [])[0];
  root.file(
    "SUMMARY.txt",
    [
      `Company: ${company}`, `Role: ${job.title}`, `Mission: ${job.mission_id ?? ""}`,
      `Location: ${job.location ?? ""}`, `Status: ${app?.stage ?? job.status ?? ""}`,
      `Applied: ${app?.date_applied ?? "NOT APPLIED"}`,
      `Source: ${job.source ?? ""}`, `Job URL: ${job.job_url ?? ""}`,
      `Post: ${job.linkedin_post_url ?? ""}`,
    ].join("\n"),
  );
  if (job.description) root.folder("Job Description")!.file("JD.txt", job.description);

  // Documents from Storage (owner-readable via RLS)
  for (const d of docs ?? []) {
    if (!d.storage_path || !d.bucket_name) continue;
    const { data: blob, error } = await supabase.storage
      .from(d.bucket_name)
      .download(d.storage_path);
    if (error || !blob) continue;
    const folder =
      d.document_type === "TAILORED_RESUME" ? "Resume"
      : d.document_type === "INTERVIEW_PREP" ? "Interview Preparation"
      : d.document_type === "EMAIL_DRAFT" ? "Email"
      : "Other";
    root.folder(folder)!.file(d.file_name, blob);
  }
  // Email drafts as text (DB source of truth)
  const mail = root.folder("Email")!;
  for (const e of drafts ?? []) {
    mail.file(
      `email-to-${(e.to_email as string).replace(/[^a-z0-9@.\-]+/gi, "_")}.txt`,
      `To: ${e.to_email}\nSubject: ${e.subject}\nStatus: ${e.status}\n\n${e.body ?? ""}`,
    );
  }
  // Contacts at this company
  const mine = (contacts ?? []).filter((c) =>
    (c as { notes?: string }).notes !== undefined,
  );
  if (mine.length > 0) {
    mail.file(
      "contacts.txt",
      mine
        .map((c) =>
          [`${c.name} (${c.role_title ?? "?"}, ${c.contact_type ?? "?"})`,
           `Email: ${c.email ?? "—"}`, `LinkedIn: ${c.linkedin_url ?? "—"}`,
           `Phone: ${c.phone ?? "—"}`].join("\n"),
        )
        .join("\n\n"),
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${company} - ${job.title} - Application Package.zip"`,
    },
  });
}
