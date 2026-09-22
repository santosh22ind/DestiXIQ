export async function verifyTurnstileToken(token: string | null, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;

  const body = new URLSearchParams();
  body.append("secret", secret);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });

  if (!res.ok) return false;
  const data = await res.json();
  return data.success === true;
}
