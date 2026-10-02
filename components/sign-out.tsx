import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LockKeyhole, LogOut } from 'lucide-react';
import { supabaseServer } from '@dokta/auth';

export function SignOut() {
  async function signOut() {
    'use server';
    const { error } = await supabaseServer().auth.signOut({ scope: 'local' });
    if (error) throw new Error('Could not sign out. Please try again.');
    redirect('/login');
  }
  return <div className="space-y-2">
    <Link href="/account/password" className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"><LockKeyhole className="h-4 w-4"/> Security</Link>
    <form action={signOut}><button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-rose-300/10 bg-rose-400/10 px-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20"><LogOut className="h-4 w-4"/> Sign out</button></form>
  </div>;
}
