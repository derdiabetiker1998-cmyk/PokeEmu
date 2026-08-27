export const theme = {
  colors: {
    primary: '#EE1515', // Pokéball red
    primaryDark: '#B3040D',
    accentYellow: '#FFCB05', // Pokéball button yellow
    background: '#F2F2F7', // iOS systemGroupedBackground (light)
    backgroundDark: '#000000',
    surface: '#FFFFFF',
    surfaceDark: '#1C1C1E',
    glassSurface: 'rgba(255,255,255,0.72)',
    glassSurfaceDark: 'rgba(28,28,30,0.72)',
    label: '#000000',
    labelDark: '#FFFFFF',
    secondaryLabel: '#3C3C4399',
  },
  radii: {
    sm: 8,
    md: 14,
    lg: 22,
    pill: 999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    largeTitle: { fontFamily: 'System', fontSize: 34, fontWeight: '700' as const },
    title: { fontFamily: 'System', fontSize: 22, fontWeight: '600' as const },
    body: { fontFamily: 'System', fontSize: 17, fontWeight: '400' as const },
    caption: { fontFamily: 'System', fontSize: 13, fontWeight: '400' as const },
  },
};

export type Theme = typeof theme;
