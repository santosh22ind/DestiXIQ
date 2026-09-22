"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createAuthClient } from "@/lib/supabase/server-client";

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
  const { error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "signup",
  });

  if (error) {
    redirect(
      `/verify?email=${encodeURIComponent(parsed.data.email)}&error=${encodeURIComponent(
        error.message,
      )}`,
    );
  }

  redirect("/");
}
