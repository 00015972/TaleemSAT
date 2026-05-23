import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: 'var(--green)',
          2: 'var(--green2)',
          d: 'var(--green-d)',
          l: 'var(--green-l)',
          xl: 'var(--green-xl)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          d: 'var(--gold-d)',
          l: 'var(--gold-l)',
          xl: 'var(--gold-xl)',
        },
        bg: {
          DEFAULT: 'var(--bg)',
          tint: 'var(--bg-tint)',
        },
        surf: {
          DEFAULT: 'var(--surf)',
          2: 'var(--surf2)',
        },
        txt: {
          DEFAULT: 'var(--txt)',
          soft: 'var(--txt-soft)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          l: 'var(--muted-l)',
        },
        border: {
          DEFAULT: 'var(--border)',
          l: 'var(--border-l)',
        },
        ok: 'var(--ok)',
        err: 'var(--err)',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        'serif-body': ['"Source Serif 4"', '"Iowan Old Style"', 'Georgia', 'serif'],
        sans: ['"DM Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        s: 'var(--rad-s)',
        DEFAULT: 'var(--rad)',
        l: 'var(--rad-l)',
      },
      boxShadow: {
        s: 'var(--shad-s)',
        DEFAULT: 'var(--shad)',
        l: 'var(--shad-l)',
        gold: 'var(--shad-gold)',
      },
      transitionTimingFunction: {
        ease: 'var(--ease)',
      },
      maxWidth: {
        wrap: '1200px',
      },
    },
  },
  plugins: [],
};

export default config;
