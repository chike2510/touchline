import type { Config } from "tailwindcss";

// Design identity: "premium dark dashboard" — deep navy/black surfaces with a
// single confident blue accent, modeled on professional sports-analytics
// dashboards. Layered surface tones (base -> panel -> card -> hover) give
// depth without resorting to pure black or neon.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0A0E17", // app background
          900: "#0F1420", // sidebar / panel background
          800: "#141A2A", // card background
          700: "#1C2436", // card hover / nested surface
          600: "#2A3450", // borders
          500: "#3A4666", // stronger borders / dividers
        },
        accent: {
          400: "#5B9EF5",
          500: "#3B82F6",
          600: "#2563EB",
        },
        positive: { 500: "#22C55E" },
        warning: { 500: "#EAB308" },
        danger: { 500: "#EF4444" },
        ink: {
          100: "#F4F6FB",
          300: "#B4BDD1",
          500: "#7B87A3",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        xs: ["12px", "1.5"],
        sm: ["13px", "1.5"],
        base: ["14.5px", "1.5"],
        lg: ["17px", "1.5"],
        xl: ["22px", "1.4"],
        "2xl": ["28px", "1.3"],
      },
      borderRadius: {
        card: "10px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.24), 0 8px 24px rgba(0,0,0,0.28)",
        panel: "0 0 0 1px rgba(58,70,102,0.5)",
      },
      screens: {
        xs: "375px",
      },
      transitionDuration: {
        150: "150ms",
        300: "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
