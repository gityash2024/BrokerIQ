/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0D9488', // teal-600
          dark: '#0F766E', // teal-700
        },
        surface: '#FFFFFF',
        background: '#F9FAFB',
        text: {
          DEFAULT: '#111827',
          secondary: '#6B7280',
        },
        border: '#E5E7EB',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
      }
    },
  },
  plugins: [],
};