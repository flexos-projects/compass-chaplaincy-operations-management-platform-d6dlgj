import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{js,vue,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './nuxt.config.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0A2D8C',
          dark: '#061B5A',
          light: '#3B65D9',
        },
        accent: '#39D2C0',
        success: '#249689',
        warning: '#F9CF58',
        error: '#E53E3E',
        neutral: {
          dark: '#14181B',
          mid: '#57636C',
          light: '#E0E3E7',
          bg: '#F1F4F8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
