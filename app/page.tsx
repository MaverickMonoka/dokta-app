import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@dokta/auth';

/** The root is a router, not a page: everyone belongs somewhere specific. */
export default async function Root() {
  const session = await getSession();
  redirect(session ? homeFor[session.role] : '/login');
}
