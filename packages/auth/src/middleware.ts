import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/', '/login', '/signup', '/auth/callback', '/legal'];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  let response = NextResponse.next({ request: { headers } });

  function login() {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname + request.nextUrl.search);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
      { cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          headers.set('cookie', request.headers.get('cookie') ?? '');
          response = NextResponse.next({ request: { headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user && !isPublic) return login();
  } catch {
    if (!isPublic) return login();
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
