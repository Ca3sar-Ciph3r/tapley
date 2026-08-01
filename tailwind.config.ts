import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Company brand colours are dynamic (from database) and applied via CSS custom properties.
      // Do not hardcode brand colours here — they are injected as inline styles or CSS vars at runtime.
      colors: {
        // `teal` is the dashboard's accent, used in 226 places. Pointing it at
        // CSS variables lets a white-labelled dashboard re-colour every one of
        // them without a single class name changing — see lib/utils/brand-ramp.ts.
        //
        // The <alpha-value> placeholder is what keeps opacity modifiers such as
        // `ring-teal-400/50` working; without it Tailwind cannot compose alpha
        // and those utilities would silently render fully opaque.
        //
        // :root in globals.css holds Tailwind's real teal, so anything outside
        // the dashboard shell — the admin panel, login — is untouched.
        teal: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        jakarta: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
  // Dark mode driven by a CSS class so we can toggle per-company brand setting
  darkMode: 'class',
}

export default config
