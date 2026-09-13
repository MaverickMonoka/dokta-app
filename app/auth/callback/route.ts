import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer, homeFor, type Role } from '@dokta/auth';

/**
 * Exchanges the auth code for a session. The profile row is created by the
 * on_auth_user_created trigger, so there is nothing to insert here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=exchange_failed`);

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single();

  await supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', data.user.id);

  return NextResponse.redirect(`${origin}${next ?? homeFor[(profile?.role ?? 'patient') as Role]}`);
}
