/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    color: {
      bg: '#20202A',
      dark: '#2C2C39',
      midgray: '#60606A',
      brightgray: '#DADAE5',
      primary: '#9696CA',
    },
  },
  plugins: [require('@kobalte/tailwindcss')],
}
