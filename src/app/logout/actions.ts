"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAuthClient } from "@/lib/supabase/server-client";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export async function signOutAction() {
  const supabase = await createAuthClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/auth");
}
