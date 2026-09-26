import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

const PROTECTED_PAGE_PATHS = ["/briefing"];
const PROTECTED_API_PATHS = ["/api/briefings"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the session token if expired; required so Server Components
  // (which can only read cookies, not set them) see an up-to-date session.
  await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedPage = PROTECTED_PAGE_PATHS.some((p) => pathname.startsWith(p));
  const isProtectedApi = PROTECTED_API_PATHS.some((p) => pathname.startsWith(p));

  if (isProtectedPage || isProtectedApi) {
    // Supabase's own session auto-refreshes silently via a long-lived
    // refresh token (that's what the getUser() call above does) — great
    // normally, but it would defeat a "re-authenticate every 5 minutes"
    // requirement. This cookie is the actual gate: it's minted fresh only
    // on OTP verification and hard-expires, independent of Supabase's
    // session state.
    const session = await verifySessionCookieValue(
      request.cookies.get(SESSION_COOKIE_NAME)?.value,
    );

    if (!session) {
      await supabase.auth.signOut();
      response.cookies.delete(SESSION_COOKIE_NAME);

      if (isProtectedApi) {
        const jsonResponse = NextResponse.json({ error: "unauthorized" }, { status: 401 });
        response.cookies.getAll().forEach((c) => jsonResponse.cookies.set(c));
        return jsonResponse;
      }

      const redirectResponse = NextResponse.redirect(new URL("/auth", request.url));
      response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
      return redirectResponse;
    }
  }

  return response;
}
