/** Keep post-auth navigation inside this app, including encoded input. */
export function safeReturnTo(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\x00-\x20]/.test(decoded)) return fallback;
    const base = 'https://dokta.invalid';
    const url = new URL(value, base);
    if (url.origin !== base || ['/login', '/signup', '/auth/callback'].includes(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
