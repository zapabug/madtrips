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
        background: "#FFFFFF",
        foreground: "#000000",
        border: "#E5E7EB",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config 