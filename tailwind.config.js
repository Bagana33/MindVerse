/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        nc: {
          bg: "#0a0e1a",
          panel: "#0d1321",
          panel2: "#0f1626",
          border: "#1e293b",
          ink: "#f0f4f8",
          muted: "#94a3b8",
          accent: "#8b5cf6",
          accentB: "#ec4899",
          accentC: "#06b6d4",
        },
      },
      boxShadow: {
        "nc-soft": "0 8px 32px rgba(0,0,0,0.35)",
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
