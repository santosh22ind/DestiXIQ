"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { isDisposableEmail } from "@/lib/disposable-email";

const requestSchema = z.object({
  email: z.string().email(),
});

export async function requestOtpAction(formData: FormData) {
  const turnstileOk = await verifyTurnstileToken(
    formData.get("cf-turnstile-response") as string | null,
  );
  if (!turnstileOk) {
    redirect(`/auth?error=${encodeURIComponent("Bot check failed. Please try again.")}`);
  }

  const parsed = requestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/auth?error=${encodeURIComponent("Enter a valid email address.")}`);
  }

  if (isDisposableEmail(parsed.data.email)) {
    redirect(
      `/auth?error=${encodeURIComponent("Disposable or temporary email addresses aren't allowed.")}`,
    );
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    redirect(`/auth?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
}
