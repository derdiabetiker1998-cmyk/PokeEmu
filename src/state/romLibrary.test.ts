import { useRomLibraryStore } from './romLibrary';

const reset = () => useRomLibraryStore.setState({ roms: [] });

describe('romLibrary store', () => {
  beforeEach(reset);

  it('starts empty', () => {
    expect(useRomLibraryStore.getState().roms).toEqual([]);
  });

  it('adds a rom entry', () => {
    useRomLibraryStore.getState().addRom({
      id: 'abc123',
      title: 'Pokemon - Emerald Version',
      filePath: '/roms/emerald.gba',
      importedAt: 1000,
    });
    expect(useRomLibraryStore.getState().roms).toHaveLength(1);
    expect(useRomLibraryStore.getState().roms[0].title).toBe('Pokemon - Emerald Version');
  });

  it('does not add a duplicate id twice', () => {
    const entry = { id: 'abc123', title: 'Emerald', filePath: '/roms/emerald.gba', importedAt: 1000 };
    useRomLibraryStore.getState().addRom(entry);
    useRomLibraryStore.getState().addRom(entry);
    expect(useRomLibraryStore.getState().roms).toHaveLength(1);
  });

  it('removes a rom by id', () => {
    useRomLibraryStore.getState().addRom({
      id: 'abc123', title: 'Emerald', filePath: '/roms/emerald.gba', importedAt: 1000,
    });
    useRomLibraryStore.getState().removeRom('abc123');
    expect(useRomLibraryStore.getState().roms).toEqual([]);
  });

  it('getRom returns the matching entry or undefined', () => {
    useRomLibraryStore.getState().addRom({
      id: 'abc123', title: 'Emerald', filePath: '/roms/emerald.gba', importedAt: 1000,
    });
    expect(useRomLibraryStore.getState().getRom('abc123')?.title).toBe('Emerald');
    expect(useRomLibraryStore.getState().getRom('missing')).toBeUndefined();
  });
});
