import type { Config } from "tailwindcss";

// Design identity v2: "cyber-sport" glass dashboard, built on the 60/30/10
// rule:
//   60% dominant   -> `navy` (retuned near-black with a cool undertone) —
//                     the app background and largest surfaces.
//   30% secondary  -> the same `navy` scale one/two steps lighter, used for
//                     cards/nav/panels — now paired with the `.glass-panel`
//                     utility (globals.css) for real glassmorphism
//                     (translucency + backdrop-blur), not just a flat color.
//   10% accent     -> `accent` (electric cyan) for primary actions/focus
//                     ONLY. `pulse` (violet) is a separate, deliberately
//                     rare secondary emphasis color (live-match state,
//                     gradient partner) — the two are never used for the
//                     same element, per the 60/30/10 discipline.
//
// Token *names* are unchanged from v1 (navy/accent/ink/positive/warning/
// danger) so every existing page inherits this reskin automatically without
// per-file edits — only the hex values and a few additive tokens changed.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#05060B", // app background
          900: "#0B0E17", // panel/sidebar base (used under glass utility)
          800: "#11141F", // card base (used under glass utility)
          700: "#1A2030", // hover / nested surface
          600: "#262E45", // borders
          500: "#37415C", // stronger borders / dividers
        },
        glass: {
          border: "rgba(150, 200, 255, 0.14)",
          highlight: "rgba(255, 255, 255, 0.04)",
        },
        accent: {
          300: "#FCA5A5",
          400: "#F0525F",
          500: "#E51E2B",
          600: "#B8121D",
        },
        pulse: {
          400: "#B98CFF",
          500: "#9D5CFF",
        },
        positive: { 500: "#2FE38A" },
        warning: { 500: "#F5C445" },
        danger: { 500: "#FF5A6E" },
        ink: {
          100: "#EAF2FF",
          300: "#9FB3D6",
          500: "#647B9E",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Type scale steps by ~1.25-1.28x, loosely golden-ratio-inspired
      // rather than arbitrary jumps.
      fontSize: {
        xs: ["12px", "1.5"],
        sm: ["13px", "1.5"],
        base: ["14.5px", "1.5"],
        lg: ["18px", "1.5"],
        xl: ["23px", "1.4"],
        "2xl": ["29px", "1.3"],
        "3xl": ["37px", "1.25"],
      },
      spacing: {
        13: "3.25rem",
        21: "5.25rem",
        34: "8.5rem",
      },
      borderRadius: {
        card: "14px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 1px rgba(0,0,0,0.3), 0 12px 32px -8px rgba(0,0,0,0.55)",
        glow: "0 0 0 1px rgba(229,30,43,0.25), 0 0 24px -4px rgba(229,30,43,0.35)",
        "glow-violet": "0 0 0 1px rgba(157,92,255,0.25), 0 0 24px -4px rgba(157,92,255,0.35)",
        panel: "0 0 0 1px rgba(150,200,255,0.10)",
      },
      screens: {
        xs: "375px",
      },
      transitionDuration: {
        150: "150ms",
        200: "200ms",
        300: "300ms",
      },
      backgroundImage: {
        "mesh-glow":
          "radial-gradient(60% 50% at 12% -10%, rgba(157,92,255,0.18) 0%, rgba(157,92,255,0) 60%), radial-gradient(55% 45% at 100% 10%, rgba(229,30,43,0.16) 0%, rgba(229,30,43,0) 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
