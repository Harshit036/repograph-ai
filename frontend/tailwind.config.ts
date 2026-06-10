import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:      '#212121',   // ChatGPT main content area
        surface: '#171717',   // sidebars / panels (darker than content)
        's2':    '#2f2f2f',   // cards, input backgrounds, user bubbles
        border:  '#3d3d3d',   // subtle dividers
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
  plugins: [],
}
export default config
