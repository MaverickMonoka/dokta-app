import { redirect } from 'next/navigation';
import { supabaseServer } from '@dokta/auth';

export function SignOut() {
  async function signOut() {
    'use server';
    const { error } = await supabaseServer().auth.signOut({ scope: 'local' });
    if (error) throw new Error('Could not sign out. Please try again.');
    redirect('/login');
  }
  return <form action={signOut}><button type="submit" className="min-h-11 text-sm text-white/70 hover:text-white">Sign out</button></form>;
}
