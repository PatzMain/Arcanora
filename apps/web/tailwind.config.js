/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        fantasy: ['"Cinzel"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        obsidian: {
          950: '#070a11',
          900: '#0d131f',
          800: '#141d2e',
          700: '#1e293b',
          600: '#334155',
        },
        rarity: {
          common: '#94a3b8',
          uncommon: '#22c55e',
          rare: '#3b82f6',
          epic: '#a855f7',
          legendary: '#eab308',
          mythic: '#ef4444',
        },
        element: {
          physical: '#94a3b8',
          fire: '#f97316',
          frost: '#06b6d4',
          lightning: '#eab308',
          holy: '#fbbf24',
          void: '#8b5cf6',
        }
      },
      keyframes: {
        beacon: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.4)', opacity: '0.4' },
        },
        floatDmg: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '0' },
          '20%': { transform: 'translateY(-10px) scale(1.2)', opacity: '1' },
          '100%': { transform: 'translateY(-40px) scale(1)', opacity: '0' },
        },
        screenShake: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(-4px, 4px)' },
          '40%': { transform: 'translate(4px, -3px)' },
          '60%': { transform: 'translate(-3px, 2px)' },
          '80%': { transform: 'translate(3px, -1px)' },
        }
      },
      animation: {
        'beacon': 'beacon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-dmg': 'floatDmg 1.2s ease-out forwards',
        'shake': 'screenShake 0.4s ease-in-out',
      }
    },
  },
  plugins: [],
};
