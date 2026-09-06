/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Work Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Palette "Boutique" — cuivre chaleureux, remplace le violet/rose.
        copper: {
          50: "#fdf6ee",
          100: "#f7efe4",
          200: "#ecd6b8",
          300: "#dfb98a",
          400: "#cf9a5c",
          500: "#c17f42",
          600: "#b5652d",
          700: "#954f24",
          800: "#78401f",
          900: "#61351c",
        },
        terracotta: {
          50: "#fdf1ee",
          100: "#f6e0d5",
          200: "#e8bda8",
          300: "#d69878",
          400: "#c2764f",
          500: "#bc5a3d",
          600: "#a8442b",
          700: "#863323",
          800: "#6b2a1d",
          900: "#552219",
        },
        olive: {
          50: "#f3f5ec",
          100: "#e6ecd9",
          200: "#ccd9b3",
          300: "#adc287",
          400: "#8ba75f",
          500: "#6b8a45",
          600: "#55702f",
          700: "#445a26",
          800: "#38481f",
          900: "#2e3a1a",
        },
      },
    },
  },
  plugins: [],
};
