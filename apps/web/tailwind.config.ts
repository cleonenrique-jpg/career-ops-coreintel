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
        // Preset 2 · Editorial Clean — neutros canónicos (la guaca / real-estate)
        tile:     '#f5f5f7',
        hairline: 'rgba(0,0,0,0.08)',
        // Estados-texto accesibles (acentos de marca oscurecidos para WCAG)
        estado: {
          ok:    '#3a7d00',
          warn:  '#9a6a00',
          error: '#c0392b',
          info:  '#0a8a96',
        },
        gris: {
          50:  '#f8fafc',
          100: '#f3f4f6',
          300: '#d1d5db',
          500: '#6e6e73',
          700: '#374151',
          900: '#1f2937',
        },
      },
      fontFamily: {
        // Preset 2 · Editorial Clean: stack de sistema (SF), excepción consciente a Montserrat.
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Dashboard-style compact sizes. Old marketing-page sizes (h1=2.5rem, h2=2rem,
      // h3=1.5rem) made every page feel huge. These are tuned for SaaS density.
      fontSize: {
        h1: ['1.5rem',  { lineHeight: '1.25', letterSpacing: '-0.015em', fontWeight: '700' }],   // 24px
        h2: ['1.25rem', { lineHeight: '1.3',  letterSpacing: '-0.01em',  fontWeight: '700' }],   // 20px
        h3: ['1.0625rem',{ lineHeight: '1.35', fontWeight: '600' }],                              // 17px
        h4: ['0.9375rem',{ lineHeight: '1.4',  fontWeight: '600' }],                              // 15px
        h5: ['0.8125rem',{ lineHeight: '1.45', fontWeight: '600' }],                              // 13px
      },
      borderRadius: { sm: '4px', DEFAULT: '8px', md: '8px', lg: '12px', xl: '16px' },
    },
  },
  plugins: [],
};

export default config;
