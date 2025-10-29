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
