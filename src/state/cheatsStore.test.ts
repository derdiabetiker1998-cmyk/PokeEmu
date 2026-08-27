import { useCheatsStore } from './cheatsStore';

describe('cheatsStore', () => {
  beforeEach(() => useCheatsStore.setState({ codesByRom: {} }));

  it('adds a code for a rom, defaulting to enabled', () => {
    useCheatsStore.getState().addCode('rom-1', '1A2B3C4D 5E6F7081');
    expect(useCheatsStore.getState().codesByRom['rom-1']).toEqual([
      { code: '1A2B3C4D 5E6F7081', enabled: true },
    ]);
  });

  it('toggles a code off', () => {
    useCheatsStore.getState().addCode('rom-1', '1A2B3C4D 5E6F7081');
    useCheatsStore.getState().setEnabled('rom-1', '1A2B3C4D 5E6F7081', false);
    expect(useCheatsStore.getState().codesByRom['rom-1'][0].enabled).toBe(false);
  });

  it('removes a code', () => {
    useCheatsStore.getState().addCode('rom-1', '1A2B3C4D 5E6F7081');
    useCheatsStore.getState().removeCode('rom-1', '1A2B3C4D 5E6F7081');
    expect(useCheatsStore.getState().codesByRom['rom-1']).toEqual([]);
  });
});
