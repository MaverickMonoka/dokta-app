import { supabaseServer } from '@dokta/auth';

/**
 * Every query in this app goes through the caller's own session, so RLS
 * applies. There is deliberately no shared service-role client here — the
 * places that legitimately need one are the edge functions, not pages.
 */
export const db = () => supabaseServer();
