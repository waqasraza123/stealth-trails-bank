/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        sand: "#f4efe5",
        parchment: "#f8f3ea",
        ink: "#14212b",
        slate: "#50606f",
        mint: "#1b8b7a",
        sea: "#72e9d4",
        ember: "#c46d35",
        danger: "#b5403d",
        border: "#d7d0c5",
        panel: "#fffdf8"
      }
    }
  },
  plugins: []
};
