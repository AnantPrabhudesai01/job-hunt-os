import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SectionTitle } from "@/components/ui";
import { IntakeClient } from "./intake-client";

// GET /intake — fast input hub. Five capture buttons; paste raw text, review
// extracted fields, then hand off to the mission form (which enforces
// NOT APPLIED + dedupe) or save a personal LinkedIn post draft.
export default async function IntakePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle kicker="FAST INPUT" title="Capture anything" />
      <IntakeClient />
    </div>
  );
}
