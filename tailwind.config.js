/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/renderer/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1a1a2e',
          card: '#252540',
          hover: '#2d2d4a',
          border: '#3a3a5c',
          text: '#e0e0e0',
          muted: '#8888aa',
          accent: '#6c63ff',
          'accent-hover': '#7b73ff',
          success: '#4caf50',
          error: '#f44336',
          warning: '#ff9800',
        },
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
}
