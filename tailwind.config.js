/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#C9B38C',
          hover: '#B59D73',
          light: '#E3D5BC',
          subtle: '#F6F2EA',
        },
        navy: {
          DEFAULT: '#262B3E',
          dark: '#1C202E',
          deep: '#121624',
          light: '#343B54',
        },
        slateMuted: '#687693',
        surface: {
          DEFAULT: '#FFFFFF',
          canvas: '#F6F6F7',
          muted: '#F5F5F6',
          light: '#F1F0F0',
        },
      },
      fontFamily: {
        serif: ['"Roboto Slab"', 'Georgia', 'serif'],
        sans: ['"Inter"', '"Open Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28, 32, 46, 0.05), 0 1px 1px rgba(28, 32, 46, 0.03)',
        elevated: '0 10px 28px rgba(28, 32, 46, 0.12)',
      },
    },
  },
  plugins: [],
};
