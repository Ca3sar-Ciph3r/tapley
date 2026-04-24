import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
        jakarta: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        syne: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        dmsans: ['var(--font-dmsans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: '#080808',
        surface: {
          DEFAULT: '#111111',
          elevated: '#1a1a1a',
        },
        border: {
          DEFAULT: '#222222',
          accent: '#2e2e2e',
        },
        brand: {
          DEFAULT: '#C8FF00',
          dim: '#9DC400',
        },
        'text-primary': '#F5F5F5',
        'text-secondary': '#888888',
        'text-muted': '#555555',
      },
      backgroundImage: {
        'gradient-hero': 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(200,255,0,0.12) 0%, transparent 70%)',
        'gradient-card': 'linear-gradient(135deg, #1a1a1a 0%, #111111 100%)',
        'gradient-brand-glow': 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(200,255,0,0.18) 0%, transparent 70%)',
      },
      animation: {
        'border-beam': 'border-beam calc(var(--duration,10s)) infinite linear',
        'meteor': 'meteor 5s linear infinite',
        'marquee': 'marquee var(--duration) linear infinite',
        'marquee-vertical': 'marquee-vertical var(--duration) linear infinite',
        'shine': 'shine 8s linear infinite',
        'float': 'float 4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.5s ease-out infinite',
        'number-count': 'number-count 1.8s ease-out forwards',
      },
      keyframes: {
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
        'meteor': {
          '0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': { transform: 'rotate(215deg) translateX(-500px)', opacity: '0' },
        },
        'marquee': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(calc(-100% - var(--gap)))' },
        },
        'marquee-vertical': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(calc(-100% - var(--gap)))' },
        },
        'shine': {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '20px',
        xl: '32px',
        full: '9999px',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

export default config
