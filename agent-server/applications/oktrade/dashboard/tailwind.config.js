/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-mantine-color-scheme="dark"]'],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  corePlugins: {
    preflight: true
  },
  theme: {
    extend: {}
  },
  plugins: [],
}