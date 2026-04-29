import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Barlow Condensed", "sans-serif"],
        sans: ["Barlow", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: {
          950: "#070b10",
          900: "#0c121a",
          850: "#111923",
          800: "#172230"
        },
        signal: {
          cyan: "#38d8d8",
          green: "#61d394",
          amber: "#f7b955",
          red: "#ff6b6b"
        }
      },
      boxShadow: {
        panel: "0 18px 60px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
} satisfies Config;
