import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAndAward } from "@/lib/achievements";

// POST /api/achievements/check — evaluate + award-once, returns fresh unlocks.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const fresh = await checkAndAward();
  return NextResponse.json({ unlocked: fresh });
}
