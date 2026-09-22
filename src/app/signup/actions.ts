"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signUpAction(formData: FormData) {
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

  redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
}
