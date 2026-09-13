/**
 * Shared Tailwind preset. Every app extends this rather than redeclaring the
 * palette, so a brand change is a one-file change.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B2137',
          raised: '#0F2E4C',
          sunken: '#071726',
          50: '#F1F5F9',
          100: '#DBE4EC',
          400: '#5A7A96',
          600: '#153A5B',
        },
        care: { DEFAULT: '#059669', soft: '#D1FAE5', dark: '#047857' },
        alert: { DEFAULT: '#DC2626', soft: '#FEE2E2' },
        warn: { DEFAULT: '#D97706', soft: '#FEF3C7' },
        canvas: '#F8FAFC',
        hairline: '#E2E8F0',
        muted: '#94A3B8',
        ink: '#0F172A',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Modular scale at 1.25, set from a 16px body.
        'display-1': ['3.5rem', { lineHeight: '1.04', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-2': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em', fontWeight: '700' }],
        'title': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '600' }],
        'lede': ['1.125rem', { lineHeight: '1.6' }],
        'meta': ['0.8125rem', { lineHeight: '1.4', letterSpacing: '0.005em' }],
      },
      borderRadius: { card: '14px', control: '10px', pill: '999px' },
      boxShadow: {
        raise: '0 1px 2px rgba(11,33,55,0.06), 0 8px 24px -12px rgba(11,33,55,0.18)',
        panel: '0 24px 60px -30px rgba(11,33,55,0.45)',
      },
      maxWidth: { prose: '68ch' },
    },
  },
  plugins: [],
};
