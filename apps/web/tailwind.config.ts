import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        desktop: "1200px",
      },
      spacing: {
        2: "var(--space-xs)",
        4: "var(--space-sm)",
        6: "var(--space-md)",
        8: "var(--space-lg)",
        12: "var(--space-xl)",
      },
      boxShadow: {
        card: "0 1.125rem 2.5rem rgba(15, 23, 42, 0.06)",
        soft: "0 0.5rem 1.5rem rgba(15, 23, 42, 0.05)",
      },
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        primary: "rgb(var(--primary) / <alpha-value>)",
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        sidebar: "rgb(var(--sidebar) / <alpha-value>)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-0.625rem)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
} satisfies Config;

export default config;
