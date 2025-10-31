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
      {
        'cosmic-focus': {
          primary: '#7c3aed',
          'primary-content': '#0f172a',
          secondary: '#1e293b',
          accent: '#facc15',
          neutral: '#0f172a',
          'base-100': '#071033',
          'base-200': '#0f172a',
          'base-300': '#111827',
          info: '#60a5fa',
          success: '#10b981',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
      {
        'sunny-meadow': {
          primary: '#16a34a',
          'primary-content': '#052e19',
          secondary: '#f59e0b',
          accent: '#6ee7b7',
          neutral: '#1f2937',
          'base-100': '#ffffff',
          'base-200': '#f7fee7',
          'base-300': '#ecfccb',
          info: '#0ea5e9',
          success: '#16a34a',
          warning: '#f59e0b',
          error: '#ef4444',
        },
      },
      {
        'ocean-whisper': {
          primary: '#0ea5e9',
          'primary-content': '#04293a',
          secondary: '#6366f1',
          accent: '#38bdf8',
          neutral: '#0f172a',
          'base-100': '#e6f7ff',
          'base-200': '#dbeafe',
          'base-300': '#bfdbfe',
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
