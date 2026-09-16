import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/docs/delete?id= — confirm intent client-side; removes object + record.
export async function DELETE(req: NextRequest) {
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
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.storage_path) {
    const { error } = await supabase.storage
      .from(doc.bucket_name)
      .remove([doc.storage_path]);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error: dbErr } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
