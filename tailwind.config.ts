import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // CareOps brand: calm, trustworthy green (health + "อุ่นใจ")
        brand: {
          50: "#eefaf3",
          100: "#d6f2e1",
          200: "#b0e4c8",
          300: "#7ccfa6",
          400: "#47b37f",
          500: "#219864",
          600: "#147a4f",
          700: "#106141",
          800: "#0e4d35",
          900: "#0c402d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
