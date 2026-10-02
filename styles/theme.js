// Water polo color palette — navy dominant, white accents, gold & red details
export const colors = {
  // Navy primaries (dominant — headers, backgrounds, cards)
  oceanDeep: '#0D1B2A',      // Deep navy
  oceanMedium: '#1B3A5C',    // Navy
  oceanLight: '#2E6DA4',     // Steel blue
  oceanBright: '#4A9FD4',    // Sky blue highlight

  // Secondary (kept for compatibility, mapped to navy family)
  teal: '#1B3A5C',
  turquoise: '#2E6DA4',
  cyan: '#4A9FD4',
  seafoam: '#C8DFF0',

  // Accent colors — water polo cap colors
  coral: '#E53935',          // Red (red team caps / danger)
  sand: '#FFC107',           // Gold / yellow (yellow caps / highlights)
  white: '#FFFFFF',
  pearl: '#D6E8F5',          // Light blue (replaces off-white)

  // Text colors
  textDark: '#0D1B2A',       // Deep navy
  textMedium: '#1B3A5C',     // Navy
  textLight: '#2E6DA4',      // Steel blue
  textMuted: '#7A8C9E',      // Blue-gray

  // Background colors — light blue tones
  backgroundLight: '#C8DFF0',
  backgroundWhite: '#E0EEF8',
  backgroundGradient: ['#0D1B2A', '#1B3A5C'],

  // Status colors
  success: '#2ecc71',
  warning: '#FFC107',        // Gold (matches yellow accent)
  error: '#E53935',          // Red (matches red accent)
  info: '#2E6DA4',

  // Pitch-specific colors
  pitch: {
    background: '#1B3A5C',              // Dark navy pool
    lines: '#4A9FD4',                   // Sky blue lines
    starterZone: 'rgba(255, 193, 7, 0.12)',
    benchZone: 'rgba(74, 159, 212, 0.08)',
  },

  // Auth screen — dark neon glass (Figma)
  auth: {
    background: '#020B18',
    neon: '#00AEEF',
    neonSoft: 'rgba(0, 174, 239, 0.35)',
    glass: 'rgba(8, 24, 48, 0.72)',
    inputBg: 'rgba(4, 16, 32, 0.85)',
    placeholder: '#7A8C9E',
    buttonTop: '#1E9FE8',
    buttonBottom: '#0B6BB5',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textDark,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textMedium,
  },
  body: {
    fontSize: 16,
    color: colors.textMedium,
  },
  caption: {
    fontSize: 14,
    color: colors.textMuted,
  },
};

export const shadows = {
  small: {
    shadowColor: colors.oceanDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: colors.oceanDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: colors.oceanDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const borderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  xl: 24,
  round: 999,
};

// Custom fonts — load in App.js before first render (see @expo-google-fonts/barlow-condensed)
export const fonts = {
  barlowCondensedRegular: 'BarlowCondensed_400Regular',
  barlowCondensedExtraBoldItalic: 'BarlowCondensed_800ExtraBold_Italic',
};


