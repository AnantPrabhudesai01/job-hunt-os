import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/storage/usage — real bytes from your private docs + assets.
// Live on every call (no cache), sums your RLS-visible rows. Free tier is 1 GB.
const FREE_BYTES = 1 * 1024 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Prefer documents.file_size (canonical, one row per uploaded file). Fall back to assets.size_bytes for any pre-doc rows.
  const [{ data: docs }, { data: assets }] = await Promise.all([
    supabase.from("documents").select("bucket_name,file_size").eq("user_id", user.id),
    supabase.from("assets").select("storage_path,size_bytes").eq("user_id", user.id),
  ]);

  const perBucket: Record<string, number> = {};
  let used = 0;
  for (const d of docs ?? []) {
    const b = d.bucket_name ?? "unknown";
    const sz = Number(d.file_size ?? 0);
    perBucket[b] = (perBucket[b] ?? 0) + sz;
    used += sz;
  }
  // Any asset whose storage_path bucket not yet covered by a doc (legacy rows) — add once.
  const docPaths = new Set((docs ?? []).map((d) => d.file_size).length ? (docs ?? []).map((d) => `${d.bucket_name}`) : []);
  // Simpler: add assets only where no doc file_size counted for that asset's file (avoid double count, best effort).
  // We keep used as docs sum (source of truth); assets sum is shown as "legacy" only when docs empty.
  const assetSum = (assets ?? []).reduce((s, a) => s + Number(a.size_bytes ?? 0), 0);
  if ((docs ?? []).length === 0) {
    used = assetSum;
    for (const a of assets ?? []) {
      const b = a.storage_path?.split("/")[0] ?? "unknown";
      perBucket[b] = (perBucket[b] ?? 0) + Number(a.size_bytes ?? 0);
    }
  }

  const pct = FREE_BYTES ? (used / FREE_BYTES) * 100 : 0;
  const secondUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL_B ?? "").trim();
  const multi = secondUrl ? "B configured (spillover ready)" : "single project (add NEXT_PUBLIC_SUPABASE_URL_B to enable spillover)";

  return NextResponse.json({
    used,
    free: FREE_BYTES,
    pct: Math.round(pct * 10) / 10,
    perBucket,
    docs: (docs ?? []).length,
    assets: (assets ?? []).length,
    multi,
    note: pct >= 95 ? "95%+ — stop uploads, archive or spill to B." : pct >= 80 ? "80% — plan archive." : "healthy",
  });
}
