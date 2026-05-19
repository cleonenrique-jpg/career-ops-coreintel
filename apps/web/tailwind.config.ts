// Coreintel brand — generated from ~/.claude/skills/coreintel-brand/styles/tailwind.config.js
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        core: {
          DEFAULT: '#41aafd',
          50:  '#eaf5ff',
          100: '#d4ebff',
          200: '#a9d7ff',
          400: '#41aafd',
          500: '#2d8fd9',
          700: '#1a5d99',
        },
        intel: {
          DEFAULT: '#4b457b',
          50:  '#eeedf5',
          100: '#d8d6e6',
          400: '#4b457b',
          700: '#332e5a',
        },
        naranja:  '#ff910e',
        lima:     '#b4d70e',
        cyan:     '#0cc1d1',
        amarillo: '#ffc00d',
        oliva:    '#9e9554',
        negro:    '#1d1e1c',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        h1: ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '700' }],
        h2: ['2rem',   { lineHeight: '1.2',  letterSpacing: '-0.015em', fontWeight: '700' }],
        h3: ['1.5rem', { lineHeight: '1.3',  letterSpacing: '-0.01em', fontWeight: '600' }],
        h4: ['1.25rem',{ lineHeight: '1.35', fontWeight: '600' }],
        h5: ['1rem',   { lineHeight: '1.4',  fontWeight: '600' }],
      },
      borderRadius: { sm: '4px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px' },
    },
  },
  plugins: [],
};

export default config;
