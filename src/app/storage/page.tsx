import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StorageClient } from "./storage-client";

// GET /storage — lifetime tracker, separate section. Live bytes from Supabase
// on every load (no cache). Shows used / 1 GB free, per-bucket split, oldest
// files, and whether a second project (Django-style multiple DBs) is configured.
export default async function StoragePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: docs }, { data: assets }] = await Promise.all([
    supabase.from("documents").select("id,file_name,bucket_name,file_size,created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(30),
    supabase.from("documents").select("bucket_name,file_size").eq("user_id", user.id),
  ]);

  const used = (assets ?? []).reduce((s, r) => s + Number(r.file_size ?? 0), 0);
  const FREE = 1 * 1024 * 1024 * 1024;
  const pct = FREE ? (used / FREE) * 100 : 0;

  const perBucket: Record<string, number> = {};
  for (const r of assets ?? []) perBucket[r.bucket_name ?? "unknown"] = (perBucket[r.bucket_name ?? "unknown"] ?? 0) + Number(r.file_size ?? 0);

  return <StorageClient initial={{ used, free: FREE, pct: Math.round(pct * 10) / 10, perBucket, oldest: docs ?? [] }} />;
}
