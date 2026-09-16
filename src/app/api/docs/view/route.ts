import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDocumentUrl } from "@/lib/storage";

// GET /api/docs/view?id=<documents.id> — ownership-checked redirect to fresh signed URL.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { data: doc } = await supabase
    .from("documents")
    .select("bucket_name,storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!doc?.storage_path) {
    return NextResponse.json(
      { error: "No cloud copy — local only." },
      { status: 404 },
    );
  }
  const url = await getDocumentUrl(doc.bucket_name, doc.storage_path);
  if (!url) return NextResponse.json({ error: "Not available" }, { status: 404 });
  return NextResponse.redirect(url);
}
