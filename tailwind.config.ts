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
