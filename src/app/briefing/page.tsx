import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server-client";
import { BriefingForm } from "./BriefingForm";

export default async function BriefingPage() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: destinations } = await supabase
    .from("destinations")
    .select("id, name, region")
    .eq("active", true)
    .order("region");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16 sm:px-10">
      <p className="text-sm font-medium text-ink/60">/ Request a briefing</p>
      <h1 className="text-4xl font-bold tracking-tight">Where are you headed?</h1>
      <BriefingForm destinations={destinations ?? []} />
    </div>
  );
}
