import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@dokta/auth';

/** Resolve the authenticated user into the correct role-specific workspace. */
export default async function DashboardRouter() {
  const session = await getSession();
  redirect(session ? homeFor[session.role] : '/login');
}
