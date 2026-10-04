/** Design tokens taken from the Waypoint design screens. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        cream: '#FDFBF0',
        navy: { DEFAULT: '#0B3457', 900: '#111827' },
        ink: '#141B2D',
        night: '#1E2438',
        brand: { DEFAULT: '#FF8D56', dark: '#E8703A', tint: '#FFF1EA', line: '#FFD9C6' },
        ok: { DEFAULT: '#1E8A6A', tint: '#E3F4EE' },
        warn: { DEFAULT: '#B7791F', tint: '#FFF4D6' },
        bad: { DEFAULT: '#D64545', tint: '#FDE8E8' },
        info: { DEFAULT: '#2F80ED', tint: '#E6F0FD' },
        muted: '#6B7280',
      },
      borderRadius: { xl2: '20px' },
      boxShadow: { card: '0 1px 2px rgba(20,27,45,.04), 0 6px 20px rgba(20,27,45,.05)' },
    },
  },
  plugins: [],
};
