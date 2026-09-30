import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";

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
  const isLoginRoute = request.nextUrl.pathname === LOGIN_PATH;

  if (!url || !publishableKey) {
    return isLoginRoute
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

  // Supabase recommends calling getClaims immediately after client creation.
  // It validates the JWT before protected Server Components are rendered.
  const {
    data: { claims },
  } = await supabase.auth.getClaims();

  const isAuthenticated = Boolean(claims?.sub);

  if (!isAuthenticated && !isLoginRoute) {
    return redirectToLogin(request);
  }

  if (isAuthenticated && isLoginRoute) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
