/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#2C2416',
        paper: '#F5F1E8',
        cream: '#FFFBF2',
        rust: '#8B5A3C',
        moss: '#3D6B4A',
        clay: '#A85751',
      },
    },
  },
  plugins: [],
};
