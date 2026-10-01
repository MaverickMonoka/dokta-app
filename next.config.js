// These are public project identifiers, not privileged credentials.
const doktaUrl = 'https://gojugsbxonazeuzjnego.supabase.co';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || doktaUrl;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (supabaseUrl === doktaUrl ? 'sb_publishable_W2LAuGwONU7WY_IR5l0Iww_-BQGUTaL' : '');

if (!supabaseKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_ANON_KEY for the configured Supabase project.');

/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['@dokta/ui', '@dokta/auth'],
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseKey,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
};
