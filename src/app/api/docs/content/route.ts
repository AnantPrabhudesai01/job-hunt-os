import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/docs/content?id=<documents.id> | ?assetId=<assets.id>
// Returns full source content for the preview modal:
// { kind: 'pdf'|'image'|'text', url?, text?, fileName, mime, meta }
// Text comes from the authoritative source bytes, never from truncated UI.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = req.nextUrl.searchParams.get("id");
  const assetId = req.nextUrl.searchParams.get("assetId");

  let fileName = "";
  let mime: string | null = null;
  let bucket: string | null = null;
  let storagePath: string | null = null;
  let meta: Record<string, unknown> = {};

  if (id) {
    const { data: doc } = await supabase
      .from("documents")
      .select(
        "file_name,mime_type,bucket_name,storage_path,file_size,version,is_current,created_at,document_type,description,jobs(mission_id,title,companies(name))",
      )
      .eq("id", Number(id))
      .eq("user_id", user.id)
      .single();
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    fileName = doc.file_name;
    mime = doc.mime_type;
    bucket = doc.bucket_name;
    storagePath = doc.storage_path;
    const job = doc.jobs as unknown as {
      mission_id: string;
      title: string;
      companies: { name?: string } | null;
    } | null;
    meta = {
      company: job?.companies?.name ?? null,
      role: job?.title ?? null,
      mission: job?.mission_id ?? null,
      version: (doc as { version: number }).version,
      type: doc.document_type,
    };
  } else if (assetId) {
    const { data: a } = await supabase
      .from("assets")
      .select("file_name,mime_type,storage_path,size_bytes,created_at,asset_type,source,job_id")
      .eq("id", Number(assetId))
      .eq("user_id", user.id)
      .single();
    if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
    fileName = a.file_name;
    mime = a.mime_type;
    meta = { type: a.asset_type, source: a.source };
    const sp = a.storage_path ?? "";
    const m = sp.match(
      /^(resumes|interview-preparation|people-research|company-research|job-descriptions|uploads|application-assets|profile-assets|documents)\//,
    );
    if (m) {
      bucket = m[1];
      storagePath = sp.slice(m[1].length + 1);
    } else {
      storagePath = null; // local-only: no cloud copy
    }
  } else {
    return NextResponse.json({ error: "id or assetId required" }, { status: 400 });
  }

  const lower = fileName.toLowerCase();
  const isText =
    (mime ?? "").startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md");
  const isImage =
    (mime ?? "").startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp"].some((e) => lower.endsWith(e));
  const isPdf = (mime ?? "") === "application/pdf" || lower.endsWith(".pdf");

  if (!storagePath || !bucket) {
    return NextResponse.json({
      kind: "localonly",
      fileName,
      mime,
      meta,
      message: "Local-only file — connect cloud sync to preview bytes here.",
    });
  }
  const bucketName: string = bucket;

  if (isText) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .download(storagePath as string);
    if (error || !data)
      return NextResponse.json({ error: "Unreadable" }, { status: 500 });
    const text = await data.text();
    return NextResponse.json({ kind: "text", text, fileName, mime, meta });
  }

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(storagePath as string, 600);
  if (error || !data?.signedUrl)
    return NextResponse.json({ error: "Unavailable" }, { status: 404 });
  return NextResponse.json({
    kind: isPdf ? "pdf" : isImage ? "image" : "file",
    url: data.signedUrl,
    fileName,
    mime,
    meta,
  });
}
