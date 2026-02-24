import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "serif"]
      },
      boxShadow: {
        heavy: "0 24px 90px rgba(0, 0, 0, 0.48)"
      }
    }
  },
  plugins: []
};

export default config;
