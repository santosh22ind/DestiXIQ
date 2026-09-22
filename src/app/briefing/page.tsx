import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server-client";
import { BriefingForm } from "./BriefingForm";

export default async function BriefingPage() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: destinations } = await supabase
    .from("destinations")
    .select("id, name, region")
    .eq("active", true)
    .order("region");

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Request a briefing</h1>
      <BriefingForm destinations={destinations ?? []} />
    </div>
  );
}
