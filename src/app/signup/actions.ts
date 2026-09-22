"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";
import { verifyTurnstileToken } from "@/lib/turnstile";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signUpAction(formData: FormData) {
  const turnstileOk = await verifyTurnstileToken(
    formData.get("cf-turnstile-response") as string | null,
  );
  if (!turnstileOk) {
    redirect(`/signup?error=${encodeURIComponent("Bot check failed. Please try again.")}`);
  }

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "Enter a valid email and a password of at least 8 characters.",
      )}`,
    );
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // OTP verification is disabled for now (email confirmations off in Supabase) —
  // signUp already returns an active session, so go straight in. Re-enable the
  // /verify redirect here when OTP comes back in a later phase.
  redirect("/");
}
