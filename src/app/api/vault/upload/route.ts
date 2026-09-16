import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_FOR_TYPE,
  BUCKETS,
  slugify,
  validateFile,
} from "@/lib/storage";

// POST multipart: file, jobId, assetType?, companyName?
// Flow: validate -> upload to typed bucket -> verify -> documents row (+ assets compat row).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const form = await req.formData();
  const file = form.get("file");
  const jobIdRaw = form.get("jobId");
  if (!(file instanceof Blob) || !jobIdRaw) {
    return NextResponse.json({ error: "file + jobId required" }, { status: 400 });
  }
  const jobId = Number(jobIdRaw);
  const assetType = String(form.get("assetType") || "SCREENSHOT");
  const bucket = BUCKET_FOR_TYPE[assetType] ?? "uploads";
  if (!(BUCKETS as readonly string[]).includes(bucket)) {
    return NextResponse.json({ error: "Unknown bucket." }, { status: 400 });
  }

  const f = file as File;
  const problem = validateFile(f, bucket);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const safe = (f.name || "upload.bin")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 100);
  const company = slugify(String(form.get("companyName") || "general"));
  const path = `${user.id}/${company}/job-${jobId}/${assetType.toLowerCase()}/${Date.now()}_${safe}`;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, {
    contentType: f.type || "application/octet-stream",
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json(
      { error: `Upload failed (local nothing lost): ${upErr.message}` },
      { status: 500 },
    );
  }
  // Verify object exists before recording (consistency rule)
  const { data: listed } = await supabase.storage.from(bucket).list(
    path.split("/").slice(0, -1).join("/"),
    { search: safe.slice(-40) },
  );
  const verified = (listed ?? []).some((o) => path.endsWith(o.name));
  if (!verified) {
    return NextResponse.json(
      { error: "Upload unverifiable — file kept only at source. Retry." },
      { status: 500 },
    );
  }

  // SHA-256 for duplicate detection
  const buf = new Uint8Array(await f.arrayBuffer());
  const hash = Buffer.from(
    await crypto.subtle.digest("SHA-256", buf),
  ).toString("hex");
  const { data: dupe } = await supabase
    .from("documents")
    .select("id,file_name")
    .eq("user_id", user.id)
    .eq("checksum", hash)
    .limit(1);
  if (dupe && dupe.length > 0) {
    await supabase.storage.from(bucket).remove([path]); // avoid orphan
    return NextResponse.json({
      ok: true,
      duplicateOf: dupe[0].file_name,
      message: "Identical file already stored — reused existing record, no duplicate created.",
    });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("company_id")
    .eq("id", jobId)
    .single();
  const { error: dbErr } = await supabase.from("documents").insert({
    user_id: user.id,
    company_id: job?.company_id ?? null,
    job_id: jobId,
    document_type: assetType,
    bucket_name: bucket,
    storage_path: path,
    file_name: safe,
    mime_type: f.type || null,
    file_size: f.size,
    version: 1,
    is_current: true,
    checksum: hash,
    source: "App upload",
    metadata: { originalName: f.name || safe },
  });
  if (dbErr) {
    // DB failed after upload: remove object to avoid orphan, report honestly
    await supabase.storage.from(bucket).remove([path]);
    return NextResponse.json(
      { error: `Record failed, uploaded file rolled back: ${dbErr.message}` },
      { status: 500 },
    );
  }
  // Compat mirror in assets (single source of truth remains documents)
  await supabase.from("assets").insert({
    user_id: user.id,
    job_id: jobId,
    asset_type: assetType,
    file_name: safe,
    mime_type: f.type || null,
    size_bytes: f.size,
    storage_path: `${bucket}/${path}`,
    sync_status: "SYNCED",
    source: "App upload",
    confidence: "HIGH",
  });
  return NextResponse.json({ ok: true, path, bucket });
}
