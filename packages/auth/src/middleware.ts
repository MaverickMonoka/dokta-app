import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/', '/login', '/auth/callback', '/legal'];

/**
 * Refreshes the session on every request and gates private routes. Role checks
 * happen in the layouts, where the database is reachable — middleware only
 * answers "is this person signed in".
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
      {
        cookies: {
          get: (name: string) => request.cookies.get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) => {
            request.cookies.set({ name, value, ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value, ...options });
          },
          remove: (name: string, options: CookieOptions) => {
            request.cookies.set({ name, value: '', ...options });
            response = NextResponse.next({ request: { headers: request.headers } });
            response.cookies.set({ name, value: '', ...options });
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;
    const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (!user && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    // Pass the path down so layouts can highlight the current nav item.
    response.headers.set('x-pathname', pathname);
    return response;
  } catch {
    return response;
  }
}
