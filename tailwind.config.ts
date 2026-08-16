import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#1d7fe0",
          600: "#1565c0",
          700: "#10529c",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
