import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bitcoin: "#F7931A",
        ocean: "#1E3A8A",
        forest: "#0F4C35",
        sand: "#F5E3C3",
        background: "#F5E3C3",
        foreground: "#F5E3C3",
        border: "#E5E7EB",
      },
      animation: {
        'fast-spin': 'spin 1s linear infinite', // regular speed default spin animation
        'progress-bar': 'progress 2s ease-in-out infinite', // 2s should be slower New progress bar animation
        'fill-empty-bar': 'fillEmpty 4s ease-in-out infinite', // Fill left-to-right, empty right-to-left
      },
      keyframes: {
        progress: {
          '0%': { width: '0%', left: '0%' },
          '50%': { width: '40%', left: '30%' },
          '100%': { width: '0%', left: '100%' }
        },
        fillEmpty: {
          // Fill from left to right
          '0%': { width: '0%', left: '0%', right: 'auto' },
          '45%': { width: '100%', left: '0%', right: 'auto' },
          '50%': { width: '100%', left: '0%', right: 'auto' },
          
          // Switch to emptying from right to left
          '50.1%': { width: '100%', left: 'auto', right: '0%' },
          '95%': { width: '0%', left: 'auto', right: '0%' },
          '100%': { width: '0%', left: '0%', right: 'auto' }
        }
      }
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config 