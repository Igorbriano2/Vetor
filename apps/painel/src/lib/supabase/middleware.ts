import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { caminhoInternoSeguro } from "@/lib/safeRedirect";

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
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicAsset = request.nextUrl.pathname.startsWith("/_next");
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");

  if (!user && isApiRoute) {
    return NextResponse.json(
      { error: "Não autenticado", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  if (!user && !isLoginRoute && !isPublicAsset) {
    const destinoOriginal = request.nextUrl.pathname + request.nextUrl.search;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (destinoOriginal !== "/") url.searchParams.set("next", destinoOriginal);
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const next = request.nextUrl.searchParams.get("next");
    const url = caminhoInternoSeguro(next)
      ? new URL(next, request.url)
      : new URL("/vetor", request.url);
    return NextResponse.redirect(url);
  }

  return response;
}
