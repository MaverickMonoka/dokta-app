'use client';

import { useEffect, useRef, useState } from 'react';
import { supabaseBrowser } from '@dokta/auth/client';

/** Email recovery links can be opened on a different device from the request. */
export function RecoverySession() {
  const started = useRef(false);
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    if (started.current) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (params.get('error')) {
      started.current = true;
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      setStatus('This sign-in link has expired or is invalid. Request a new password reset from the login page.');
      return;
    }
    if (params.get('type') !== 'recovery' || !accessToken || !refreshToken) return;
    started.current = true;
    // Clear the fragment before initializing the cookie-based auth client.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setStatus('Opening your password reset…');
    void (async () => {
      try {
        const { error } = await supabaseBrowser().auth.setSession({
          access_token: accessToken, refresh_token: refreshToken,
        });
        if (error) throw error;
        window.location.replace('/account/password');
      } catch {
        setStatus('Could not open this reset link. Request a new password reset from the login page.');
      }
    })();
  }, []);

  if (!status) return null;
  return <div role="status" className="fixed inset-x-4 top-4 z-50 mx-auto max-w-md rounded-xl border border-care bg-white p-4 text-sm text-navy shadow-lg">{status}</div>;
}
