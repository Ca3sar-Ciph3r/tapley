import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: 'var(--brand-color)',
        ink: '#16181D',
        stone: '#A7A3A8',
        mist: '#E7E5E4',
        bg: '#F7F7F5',
        'tapley-orange': '#F59608',
        violet: '#6D28F5',
      },
      borderRadius: {
        card: '24px',
        button: '999px',
      },
      keyframes: {
        'nfc-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.6' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
        'stamp-pulse': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.2)', opacity: '0.8' },
        },
        'reward-glow': {
          '0%, 100%': { boxShadow: '0 0 20px 0 rgba(34,197,94,0.4)' },
          '50%': { boxShadow: '0 0 40px 8px rgba(34,197,94,0.6)' },
        },
        'progress-fill': {
          '0%': { width: '0%' },
          '100%': { width: '100%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'nfc-pulse': 'nfc-pulse 2s ease-in-out infinite',
        'stamp-pulse': 'stamp-pulse 2s ease-in-out infinite',
        'reward-glow': 'reward-glow 2s ease-in-out infinite',
        'progress-fill': 'progress-fill 1.5s ease-out forwards',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
