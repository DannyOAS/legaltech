/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f1f8ff",
          500: "#1d4ed8",
          600: "#1e3a8a",
        },
      },
    },
  },
  plugins: [],
};
