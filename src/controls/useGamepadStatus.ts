import { useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';
import { PokeEmuCore } from '../native/PokeEmuCore';

export function useGamepadStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // The controllerStatusChanged listener below only reports FUTURE
    // connect/disconnect events. A controller already connected before this
    // effect subscribes (paired before app launch, or before this screen
    // mounted) would never be reported without also asking for the current
    // state up front.
    PokeEmuCore.isControllerConnected().then((isConnected) => {
      if (!cancelled) setConnected(isConnected);
    });

    const emitter = new NativeEventEmitter(NativeModules.PokeEmuCore);
    const subscription = emitter.addListener('controllerStatusChanged', (isConnected: boolean) => {
      setConnected(isConnected);
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  return connected;
}
