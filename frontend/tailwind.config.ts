import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:      '#000000',   // main content area — true black
        surface: '#0a0a0a',   // sidebars / panels
        's2':    '#171717',   // cards, input backgrounds, user bubbles
        border:  '#262626',   // subtle dividers
        accent:  '#60a5fa',
        muted:   '#8c8c8c',
        success: '#10b981',
        warning: '#f59e0b',
        danger:  '#ef4444',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 1.5s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
export default config
