import type { Config } from "tailwindcss";

// Design identity: "tactics board / matchday programme" — a deep pitch-green
// and chalk system with a floodlight-amber accent, grease-pencil dividers,
// and monospace data tables (deliberately avoiding the cream+terracotta and
// near-black+neon defaults).
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#0A2118",
          900: "#0F3D2E",
          800: "#154A38",
          700: "#1E5B46",
          600: "#2C7057",
        },
        chalk: {
          100: "#F5F3EC",
          200: "#E9E5D8",
          300: "#D8D2BF",
        },
        floodlight: {
          400: "#E8A33D",
          500: "#D68F26",
          600: "#B8721A",
        },
        rival: {
          500: "#B23A2E",
        },
        ink: {
          900: "#141915",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        xs: ["12px", "1.5"],
        sm: ["14px", "1.5"],
        base: ["16px", "1.5"],
        lg: ["18px", "1.5"],
        xl: ["24px", "1.4"],
        "2xl": ["32px", "1.3"],
      },
      spacing: {
        18: "4.5rem",
      },
      borderRadius: {
        card: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(10,33,24,0.08), 0 4px 12px rgba(10,33,24,0.10)",
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
