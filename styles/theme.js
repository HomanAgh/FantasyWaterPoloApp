// Ocean-themed color palette for Fantasy Water Polo App
export const colors = {
  // Primary ocean blues
  oceanDeep: '#006994',      // Deep ocean blue
  oceanMedium: '#0088cc',    // Medium ocean blue
  oceanLight: '#00a8e8',      // Light ocean blue
  oceanBright: '#00d4ff',     // Bright aqua
  
  // Secondary colors
  teal: '#20b2aa',           // Teal
  turquoise: '#40e0d0',      // Turquoise
  cyan: '#00ffff',            // Cyan
  seafoam: '#7fffd4',        // Seafoam green
  
  // Accent colors
  coral: '#ff6b6b',           // Coral accent
  sand: '#f4e4bc',            // Sand beige
  white: '#ffffff',           // White
  pearl: '#f8f9fa',           // Pearl white
  
  // Text colors
  textDark: '#1a1a2e',        // Dark text
  textMedium: '#16213e',      // Medium text
  textLight: '#0f3460',       // Light text
  textMuted: '#6c757d',       // Muted text
  
  // Background colors
  backgroundLight: '#e8f4f8', // Light sky blue background
  backgroundWhite: '#ffffff', // White background
  backgroundGradient: ['#006994', '#00a8e8'], // Gradient colors
  
  // Status colors
  success: '#2ecc71',         // Success green
  warning: '#f39c12',         // Warning orange
  error: '#e74c3c',           // Error red
  info: '#3498db',            // Info blue
  
  // Pitch-specific colors (for PitchView component)
  pitch: {
    background: '#2d8f3a',           // Water polo pool green/blue
    lines: '#ffffff',                 // White lines
    starterZone: 'rgba(0, 200, 255, 0.1)',  // Light blue tint for starters
    benchZone: 'rgba(128, 128, 128, 0.1)',  // Light gray tint for bench
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


