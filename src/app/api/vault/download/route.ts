import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS } from "@/lib/storage";

// GET /api/vault/download?path=<bucket>/<user-uuid/...> -> short-lived redirect.
// Accepts legacy bare paths (assumed to live in the `documents` bucket).
// RLS on storage.objects guarantees owners see only their own files.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const raw = req.nextUrl.searchParams.get("path");
  if (!raw) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let bucket = "documents";
  let path = raw;
  const first = raw.split("/")[0];
  if ((BUCKETS as readonly string[]).includes(first)) {
    bucket = first;
    path = raw.slice(first.length + 1);
  }
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 120);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }
  return NextResponse.redirect(data.signedUrl);
}
