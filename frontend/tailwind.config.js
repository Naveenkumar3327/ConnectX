/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enables dark mode toggles via 'dark' class
  theme: {
    extend: {
      colors: {
        whatsapp: {
          light: '#25D366',
          teal: '#128C7E',
          dark: '#075E54',
          blue: '#34B7F1',
          bg: '#ece5dd',
          gray: '#F0F2F5',
        },
        dark: {
          bg: '#0b141a',
          sidebar: '#111b21',
          chat: '#0b141a',
          active: '#2a3942',
          bubble: '#005c4b',
          incoming: '#202c33',
          text: '#e9edef',
          muted: '#8696a0',
        }
      }
    },
  },
  plugins: [],
}
