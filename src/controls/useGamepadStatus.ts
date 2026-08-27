import { useEffect, useState } from 'react';
import { NativeEventEmitter, NativeModules } from 'react-native';

export function useGamepadStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const emitter = new NativeEventEmitter(NativeModules.PokeEmuCore);
    const subscription = emitter.addListener('controllerStatusChanged', (isConnected: boolean) => {
      setConnected(isConnected);
    });
    return () => subscription.remove();
  }, []);

  return connected;
}
