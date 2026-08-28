import { usePokedexProgressStore } from './pokedexProgress';

describe('pokedexProgress', () => {
  beforeEach(() => usePokedexProgressStore.setState({ caught: {} }));

  it('starts uncaught', () => {
    expect(usePokedexProgressStore.getState().caught['1']).toBeUndefined();
  });

  it('toggles a pokemon to caught', () => {
    usePokedexProgressStore.getState().toggleCaught('1');
    expect(usePokedexProgressStore.getState().caught['1']).toBe(true);
  });

  it('toggles a caught pokemon back to uncaught', () => {
    usePokedexProgressStore.getState().toggleCaught('1');
    usePokedexProgressStore.getState().toggleCaught('1');
    expect(usePokedexProgressStore.getState().caught['1']).toBe(false);
  });

  it('tracks entries independently by key', () => {
    usePokedexProgressStore.getState().toggleCaught('6-mega-x');
    expect(usePokedexProgressStore.getState().caught['6-mega-x']).toBe(true);
    expect(usePokedexProgressStore.getState().caught['6-mega-y']).toBeUndefined();
  });
});
