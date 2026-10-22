/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#ff4b3a', 
        dark: '#1e1e2d', 
        light: '#f5f5f8' 
      }
    },
  },
  plugins: [],
}