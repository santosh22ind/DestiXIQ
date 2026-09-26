"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-cookie";

const verifySchema = z.object({
  email: z.string().email(),
  token: z.string().min(6).max(6),
});

export async function verifyOtpAction(formData: FormData) {
  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    token: formData.get("token"),
  });

  if (!parsed.success) {
    const email = String(formData.get("email") ?? "");
    redirect(
      `/verify?email=${encodeURIComponent(email)}&error=${encodeURIComponent(
        "Enter the 6-digit code from your email.",
      )}`,
    );
  }

  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "email",
  });

  if (error || !data.user) {
    redirect(
      `/verify?email=${encodeURIComponent(parsed.data.email)}&error=${encodeURIComponent(
        error?.message ?? "Verification failed.",
      )}`,
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionCookieValue(data.user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect("/briefing");
}
