import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";

// Supabase Auth's "Send Email" hook — Supabase calls this endpoint whenever
// it needs to send an auth email (OTP sign-in here), instead of using its
// own built-in sender. This lets the actual email delivery run through
// Brevo, using credentials that stay only in our own env vars and are
// never given to Supabase. Requires a public URL, so only usable once
// deployed — configure the hook itself in the Supabase dashboard
// (Authentication -> Hooks -> Send Email) pointing at
// https://<your-domain>/api/auth/send-email, which also gives you the
// signing secret for SUPABASE_AUTH_HOOK_SECRET below.

type SendEmailPayload = {
  user: { email: string };
  email_data: {
    token: string;
    email_action_type: string;
  };
};

export async function POST(request: Request) {
  const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!hookSecret || !brevoApiKey || !senderEmail) {
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const payload = await request.text();
  const headers = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  // Supabase issues this secret as "v1,whsec_<base64>" — the standardwebhooks
  // library only strips its own "whsec_" prefix, not the leading "v1,", so
  // that has to come off first or every signature verification fails.
  const normalizedSecret = hookSecret.replace(/^v1,/, "");

  let event: SendEmailPayload;
  try {
    const wh = new Webhook(normalizedSecret);
    event = wh.verify(payload, headers) as SendEmailPayload;
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const { user, email_data: emailData } = event;

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": brevoApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: "DestiXIQ" },
      to: [{ email: user.email }],
      subject: "Your DestiXIQ sign-in code",
      htmlContent: `<p>Your DestiXIQ sign-in code is:</p><h2 style="letter-spacing:0.2em">${emailData.token}</h2><p>This code expires shortly. If you didn't request this, you can safely ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: "brevo_send_failed", detail }, { status: 500 });
  }

  return NextResponse.json({});
}
