import daisyui from 'daisyui'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          light: '#a5b4fc',
        },
        primary: '#6366f1',
        secondary: '#8b5cf6',
        accent: '#f472b6',
        glass: {
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
          400: 'rgba(255, 255, 255, 0.4)',
          500: 'rgba(255, 255, 255, 0.5)',
          600: 'rgba(255, 255, 255, 0.6)',
          700: 'rgba(255, 255, 255, 0.7)',
          800: 'rgba(255, 255, 255, 0.8)',
          900: 'rgba(255, 255, 255, 0.9)',
        },
        'glass-dark': {
          800: 'rgba(15, 23, 42, 0.6)',
          900: 'rgba(15, 23, 42, 0.8)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '1rem',
        xl: '1.5rem',
        '2xl': '2rem',
        '3xl': '2.5rem',
        pill: '9999px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-card': '0 4px 30px rgba(0, 0, 0, 0.1)',
        glow: '0 0 15px rgba(99, 102, 241, 0.5)',
        'glow-accent': '0 0 15px rgba(244, 114, 182, 0.5)',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        neurolearn: {
          primary: '#6366f1',
          'primary-content': '#fdf5ff',
          secondary: '#f472b6',
          accent: '#22d3ee',
          neutral: '#1f2937',
          'base-100': '#ffffff',
          'base-200': '#f1f5ff',
          'base-300': '#e2e8f0',
          info: '#60a5fa',
          success: '#22c55e',
          warning: '#fbbf24',
          error: '#ef4444',
        },
      },
      'light',
    ],
  },
}
