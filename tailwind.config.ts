import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff4fe",
          100: "#e8effd",
          500: "#3b74ee",
          600: "#2563eb",
          700: "#1d4fc4",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
