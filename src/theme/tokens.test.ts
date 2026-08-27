import { theme } from './tokens';

describe('theme tokens', () => {
  it('exposes the Pokéball-red accent as the primary color', () => {
    expect(theme.colors.primary).toBe('#EE1515');
  });

  it('exposes an Apple-style system font family', () => {
    expect(theme.typography.body.fontFamily).toBe('System');
  });

  it('exposes a translucent surface color for blur/glass panels', () => {
    expect(theme.colors.glassSurface).toMatch(/^rgba\(/);
  });

  it('exposes a consistent 8pt spacing scale', () => {
    expect(theme.spacing.md).toBe(16);
    expect(theme.spacing.lg).toBe(24);
  });
});
