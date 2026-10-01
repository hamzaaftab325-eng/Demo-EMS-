import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/set-password",
  "/signup",
]);

function redirectToLogin(request: NextRequest, code?: string) {
  const url = request.nextUrl.clone();
  const originalPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  url.pathname = LOGIN_PATH;
  url.search = "";

  if (code) {
    url.searchParams.set("error", code);
  }

  if (request.nextUrl.pathname !== "/") {
    url.searchParams.set("next", originalPath);
  }

  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const pathname = request.nextUrl.pathname;
  const isPublicAuthRoute = PUBLIC_AUTH_PATHS.has(pathname);

  if (!url || !publishableKey) {
    return isPublicAuthRoute
      ? NextResponse.next({ request })
      : redirectToLogin(request, "configuration");
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );

        Object.entries(headers).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claimsData?.claims?.sub);

  if (!isAuthenticated && !isPublicAuthRoute) {
    return redirectToLogin(request);
  }

  if (
    isAuthenticated &&
    (pathname === "/login" || pathname === "/forgot-password")
  ) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
