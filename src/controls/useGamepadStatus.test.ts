import { renderHook, act } from '@testing-library/react-native';
import { DeviceEventEmitter, NativeModules } from 'react-native';
import { useGamepadStatus } from './useGamepadStatus';

// NativeEventEmitter's real implementation requires a non-null module
// argument. NativeModules.PokeEmuCore doesn't exist in this Jest
// environment (there's no real native module registered), so give it a
// stand-in — mutating the already-mocked NativeModules object directly,
// rather than jest.mock('react-native', ...), which pulls in the real
// module tree via jest.requireActual and crashes on TurboModuleRegistry
// calls (NativeDevMenu, etc.) that need an actual native runtime.
(NativeModules as Record<string, unknown>).PokeEmuCore = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

describe('useGamepadStatus', () => {
  it('starts disconnected and flips true when the native event fires', async () => {
    const { result } = await renderHook(() => useGamepadStatus());
    expect(result.current).toBe(false);

    await act(() => {
      DeviceEventEmitter.emit('controllerStatusChanged', true);
    });
    expect(result.current).toBe(true);
  });
});
