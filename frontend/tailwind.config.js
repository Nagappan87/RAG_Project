/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.15)',
          dark: 'rgba(15, 23, 42, 0.45)',
          borderLight: 'rgba(255, 255, 255, 0.25)',
          borderDark: 'rgba(255, 255, 255, 0.08)'
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
