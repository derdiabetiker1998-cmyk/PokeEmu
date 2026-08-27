import { useSessionStore } from './session';

describe('session store', () => {
  beforeEach(() => useSessionStore.setState({ activeRomId: null }));

  it('starts with no active rom', () => {
    expect(useSessionStore.getState().activeRomId).toBeNull();
  });

  it('sets and clears the active rom id', () => {
    useSessionStore.getState().setActiveRomId('rom-1');
    expect(useSessionStore.getState().activeRomId).toBe('rom-1');
    useSessionStore.getState().setActiveRomId(null);
    expect(useSessionStore.getState().activeRomId).toBeNull();
  });
});
