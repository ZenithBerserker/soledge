import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#12141c',
        ink: '#0a0b0f',
      },
    },
  },
  plugins: [],
}

export default config
