/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Exact Rescale Framer Template Tokens (:root)
        canvas: '#F9FAFB',
        surface: '#FFFFFF',
        muted: '#F1F2F9',
        softline: '#E3E6FA',
        line: '#DFE1F5',
        peri: {
          50: '#F1F2F9',
          100: '#E3E6FA',
          200: '#DFE1F5',
          300: '#A5A4FA',
          400: '#8E9AE2',
          500: '#7584D6',
          600: '#545C9E',
          700: '#465478',
          800: '#2E3856',
          900: '#192038',
        },
        skycyan: '#80E5FF',
        flamingopink: '#FF9FD7',
        warmcoral: '#FA6E43',
        softsalmon: '#FA9A7C',
        slatenavy: '#465478',
        neutralgray: '#888891',
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        card: '22px',
        panel: '26px',
        pill: '9999px',
      },
      boxShadow: {
        'rescale-card':
          '0 10px 30px -12px rgba(58, 68, 133, 0.08), 0 2px 6px -1px rgba(58, 68, 133, 0.04)',
        'rescale-hover':
          '0 18px 40px -14px rgba(84, 92, 158, 0.15), 0 4px 10px -2px rgba(84, 92, 158, 0.06)',
        'rescale-btn':
          '0px 1.57px 0.94px -1.5px rgba(136, 138, 227, 0.46), 0px 4.15px 2.49px -2.25px rgba(136, 138, 227, 0.43), 0px 13px 7.8px -3px rgba(136, 138, 227, 0.32), inset 0px 0px 2px 0px rgba(30, 33, 115, 0.28)',
        'rescale-white':
          '0px 1.7px 1px -1.5px rgba(136, 138, 227, 0.28), 0px 8px 16px -4px rgba(136, 138, 227, 0.16), inset 0px 0px 1.5px 0px rgba(30, 33, 115, 0.14)',
        'rescale-nav':
          '0 0.65px 0.65px -0.75px rgba(37, 31, 92, 0.14), 0 3.9px 3.9px -2.25px rgba(37, 31, 92, 0.12), 0 16px 24px -6px rgba(37, 31, 92, 0.08)',
        'icon-ring':
          '0 8px 18px -6px rgba(84, 92, 158, 0.14), inset 0 2px 0 rgba(255, 255, 255, 0.95)',
        soft: '0 10px 30px -12px rgba(58, 68, 133, 0.08), 0 2px 6px -1px rgba(58, 68, 133, 0.04)',
        panel: '0 24px 60px -20px rgba(37, 31, 92, 0.20)',
      },
      backgroundImage: {
        'rescale-btn':
          'linear-gradient(123deg, rgb(89, 103, 181) -12%, rgb(144, 142, 237) 88.69%)',
        'rescale-white':
          'linear-gradient(123deg, rgb(249, 250, 251) -12%, rgb(255, 255, 255) 88.69%)',
        'rescale-wordmark':
          'linear-gradient(96deg, #80E5FF 0%, #7584D6 68%, #545C9E 100%)',
        'rescale-smart':
          'linear-gradient(108deg, rgb(128, 229, 255) 8%, rgb(117, 132, 214) 52%, rgb(84, 92, 158) 96%)',
        'rescale-eyebrow':
          'linear-gradient(123deg, rgb(13, 207, 255) 11%, rgb(106, 113, 168) 48%)',
        'rescale-hero-wash':
          'linear-gradient(180deg, #E8F0FE 0%, #F4F5FC 48%, #F9FAFB 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-10px) rotate(3deg)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.34s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.22s ease-out both',
        'slide-in': 'slide-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 6.5s ease-in-out infinite',
        marquee: 'marquee 26s linear infinite',
      },
    },
  },
  plugins: [],
};
