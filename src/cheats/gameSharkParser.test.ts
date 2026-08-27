import { parseGameSharkCode } from './gameSharkParser';

describe('parseGameSharkCode', () => {
  it('accepts a well-formed code and normalizes to uppercase', () => {
    expect(parseGameSharkCode('1a2b3c4d 5e6f7081')).toEqual({
      valid: true,
      normalized: '1A2B3C4D 5E6F7081',
    });
  });

  it('accepts a code missing the space and inserts it', () => {
    expect(parseGameSharkCode('1A2B3C4D5E6F7081')).toEqual({
      valid: true,
      normalized: '1A2B3C4D 5E6F7081',
    });
  });

  it('rejects a code with non-hex characters', () => {
    expect(parseGameSharkCode('1A2B3C4Z 5E6F7081').valid).toBe(false);
  });

  it('rejects a code with the wrong length', () => {
    expect(parseGameSharkCode('1A2B3C4D 5E6F708').valid).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(parseGameSharkCode('').valid).toBe(false);
  });
});
