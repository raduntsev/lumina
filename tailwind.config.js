/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // ── Lumina Color System ─────────────────────────────────────────
      colors: {
        // Base canvas
        milk: {
          DEFAULT: '#F5F0E8',
          50:  '#FDFBF7',
          100: '#FAF7F0',
          200: '#F5F0E8',
          300: '#EDE5D4',
          400: '#E0D5BE',
        },
        // Structural lines & text
        bark: {
          DEFAULT: '#2C1F14',
          50:  '#7A6355',
          100: '#5C4A3A',
          200: '#3D2E20',
          300: '#2C1F14',
          400: '#1A1008',
        },
        // Primary accent — warm terracotta
        terra: {
          DEFAULT: '#B85C3A',
          50:  '#FDF0EB',
          100: '#F5D4C5',
          200: '#E8A888',
          300: '#D4744E',
          400: '#B85C3A',
          500: '#963D22',
          600: '#722A13',
        },
        // Secondary accent — warm gold
        wheat: {
          DEFAULT: '#C9922A',
          50:  '#FEF8EC',
          100: '#FAEAC8',
          200: '#F2CE82',
          300: '#E5AE44',
          400: '#C9922A',
          500: '#A67118',
        },
        // Status colors (8-bit solid)
        pine: {
          DEFAULT: '#3A6B3A',
          light: '#5A8F5A',
        },
        rust: {
          DEFAULT: '#8B2E2E',
          light: '#B85050',
        },
        // Surface levels
        surface: {
          0: '#F5F0E8', // canvas
          1: '#EDE5D4', // card
          2: '#E0D5BE', // elevated card
          3: '#D0C4A8', // highest elevation
        },
      },

      // ── Typography ──────────────────────────────────────────────────
      fontFamily: {
        sans: ['Geist', 'Inter', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
        display: ['Geist', 'Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        xs:   ['0.75rem',  { lineHeight: '1.25rem' }],
        sm:   ['0.875rem', { lineHeight: '1.375rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        md:   ['1.0625rem',{ lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.875rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
        '5xl':['3rem',     { lineHeight: '1.2' }],
        '6xl':['3.75rem',  { lineHeight: '1.1' }],
        '7xl':['4.5rem',   { lineHeight: '1.05' }],
        '8xl':['6rem',     { lineHeight: '1' }],
      },

      // ── Spacing (8px grid) ──────────────────────────────────────────
      spacing: {
        px: '1px',
        0.5: '0.125rem',  // 2px
        1:   '0.25rem',   // 4px
        2:   '0.5rem',    // 8px
        3:   '0.75rem',   // 12px
        4:   '1rem',      // 16px
        5:   '1.25rem',   // 20px
        6:   '1.5rem',    // 24px
        7:   '1.75rem',   // 28px
        8:   '2rem',      // 32px
        9:   '2.25rem',   // 36px
        10:  '2.5rem',    // 40px
        12:  '3rem',      // 48px
        14:  '3.5rem',    // 56px
        16:  '4rem',      // 64px
        18:  '4.5rem',    // 72px
        20:  '5rem',      // 80px
        24:  '6rem',      // 96px
        28:  '7rem',      // 112px
        32:  '8rem',      // 128px
        36:  '9rem',      // 144px
        40:  '10rem',     // 160px
        48:  '12rem',     // 192px
        56:  '14rem',     // 224px
        64:  '16rem',     // 256px
      },

      // ── Border widths ───────────────────────────────────────────────
      borderWidth: {
        DEFAULT: '1px',
        0: '0',
        1: '1px',
        2: '2px',
        3: '3px',
        4: '4px',
      },

      // ── No border radius (Swiss grid — sharp corners) ───────────────
      borderRadius: {
        none: '0',
        // Only allow px for pixel-art accents
        px: '1px',
      },

      // ── Grid ────────────────────────────────────────────────────────
      gridTemplateColumns: {
        // Asymmetric Swiss editorial grids
        'lumina-main': '280px 1fr',
        'lumina-3col': '1fr 1fr 1fr',
        'lumina-cal':  'repeat(7, 1fr)',
        'lumina-card': 'repeat(auto-fill, minmax(200px, 1fr))',
      },

      // ── No box shadows (flat Swiss aesthetic) ───────────────────────
      boxShadow: {
        none: 'none',
        // Inset for focus states only
        'focus-inset': 'inset 0 0 0 2px #B85C3A',
      },

      // ── Transitions ─────────────────────────────────────────────────
      transitionDuration: {
        fast: '80ms',
        DEFAULT: '150ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        'swiss': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },

      // ── Z-index scale ───────────────────────────────────────────────
      zIndex: {
        behind: '-1',
        base:   '0',
        raised: '10',
        nav:    '20',
        overlay:'30',
        modal:  '40',
        toast:  '50',
      },
    },
  },
  plugins: [],
};
