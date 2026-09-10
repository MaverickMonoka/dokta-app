import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { homeFor, mayOpen, type Role } from './roles';

export function supabaseServer() {
  const store = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookies: {
        get: (name: string) => store.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            store.set({ name, value, ...options });
          } catch {
            // Server Components cannot set cookies; middleware refreshes instead.
          }
        },
        remove: (name: string, options: CookieOptions) => {
          try {
            store.set({ name, value: '', ...options });
          } catch {
            /* see above */
          }
        },
      },
    },
  );
}

/**
 * Service-role client. Bypasses RLS entirely — only call it from code that has
 * already established who the caller is and why they may bypass it.
 */
export function supabaseAdmin() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export interface Session {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
}

export async function getSession(): Promise<Session | null> {
  try {
    const supabase = supabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
      .from('users')
      .select('id, full_name, email, role, avatar_url, is_active')
      .eq('id', user.id)
      .single();

    if (!data?.is_active) return null;

    return {
      id: data.id,
      name: data.full_name,
      email: data.email,
      role: data.role as Role,
      avatarUrl: data.avatar_url,
    };
  } catch {
    return null;
  }
}

export async function requireSession(returnTo = '/'): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return session;
}

/** Session plus an area check. Wrong role lands on their own home, not a 403. */
export async function requireArea(path: string): Promise<Session> {
  const session = await requireSession(path);
  if (!mayOpen(session.role, path)) redirect(homeFor[session.role]);
  return session;
}
