// A minimal signed, hard-expiring session cookie, separate from Supabase
// Auth's own session cookie. Supabase's client silently auto-refreshes its
// session using a long-lived refresh token — great for normal apps, but it
// defeats a "re-authenticate via OTP every N minutes" requirement. This
// cookie is the actual gate: proxy.ts checks its age directly rather than
// trusting Supabase's session state. Uses Web Crypto (not Node's `crypto`
// module) so it works in both the Node runtime and proxy.ts's Edge runtime.

export const SESSION_COOKIE_NAME = "dxiq_session";
export const SESSION_MAX_AGE_SECONDS = 5 * 60;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

async function hmac(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Buffer.from(sigBuffer).toString("base64url");
}

export async function createSessionCookieValue(userId: string): Promise<string> {
  const payload = `${userId}.${Date.now()}`;
  const signature = await hmac(payload, getSecret());
  return `${payload}.${signature}`;
}

export async function verifySessionCookieValue(
  value: string | undefined,
): Promise<{ userId: string } | null> {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAtStr, signature] = parts;
  const payload = `${userId}.${issuedAtStr}`;

  const expectedSignature = await hmac(payload, getSecret());
  if (expectedSignature !== signature) return null;

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  const ageSeconds = (Date.now() - issuedAt) / 1000;
  if (ageSeconds > SESSION_MAX_AGE_SECONDS || ageSeconds < 0) return null;

  return { userId };
}
