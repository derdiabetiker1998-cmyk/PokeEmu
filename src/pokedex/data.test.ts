import { pokedexEntries, spriteForEntry, displayName } from './data';

describe('pokedex data', () => {
  it('includes the full National Dex plus regional forms and Mega Evolutions', () => {
    expect(pokedexEntries.length).toBe(1131);
    expect(pokedexEntries.filter((e) => e.isMega).length).toBe(48);
  });

  it('resolves a sprite for every entry', () => {
    for (const entry of pokedexEntries) {
      expect(spriteForEntry(entry.key)).toBeTruthy();
    }
  });

  it('formats a base form plainly', () => {
    const bulbasaur = pokedexEntries.find((e) => e.key === '1')!;
    expect(displayName(bulbasaur)).toBe('Bulbasaur');
  });

  it('formats a Mega Evolution with its X/Y suffix', () => {
    const megaCharizardX = pokedexEntries.find((e) => e.key === '6-mega-x')!;
    expect(displayName(megaCharizardX)).toBe('Charizard (Mega X)');
  });

  it('formats a regional form with its region name', () => {
    const alolanRaichu = pokedexEntries.find((e) => e.key === '26-alola')!;
    expect(displayName(alolanRaichu)).toBe('Raichu (Alola)');
  });

  it('gives distinct names to forms sharing a region prefix', () => {
    const aqua = pokedexEntries.find((e) => e.key === '128-paldea-aqua-breed')!;
    const blaze = pokedexEntries.find((e) => e.key === '128-paldea-blaze-breed')!;
    const combat = pokedexEntries.find((e) => e.key === '128-paldea-combat-breed')!;
    const names = [aqua, blaze, combat].map(displayName);
    expect(new Set(names).size).toBe(3);
    expect(names).toEqual(['Tauros (Paldea Aqua Breed)', 'Tauros (Paldea Blaze Breed)', 'Tauros (Paldea Combat Breed)']);
  });
});
