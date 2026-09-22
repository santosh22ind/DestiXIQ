"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";
import { verifyTurnstileToken } from "@/lib/turnstile";

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signInAction(formData: FormData) {
  const turnstileOk = await verifyTurnstileToken(
    formData.get("cf-turnstile-response") as string | null,
  );
  if (!turnstileOk) {
    redirect(`/login?error=${encodeURIComponent("Bot check failed. Please try again.")}`);
  }

  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password.")}`);
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}
