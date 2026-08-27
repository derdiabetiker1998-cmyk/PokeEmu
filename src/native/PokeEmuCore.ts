import { NativeModules } from 'react-native';
import { GBAButton } from './buttons';

type PokeEmuCoreNative = {
  loadROM(path: string): Promise<{ width: number; height: number }>;
  unloadROM(): Promise<void>;
  play(): void;
  pause(): void;
  setButtonState(button: string, pressed: boolean): void;
  setFastForward(enabled: boolean, speedMultiplier: number): void;
  saveState(romId: string, slotIndex: number): Promise<void>;
  loadState(romId: string, slotIndex: number): Promise<void>;
  applyCheat(code: string, enabled: boolean): Promise<boolean>;
  removeAllCheats(): void;
  setSoundEnabled(enabled: boolean): void;
};

export const PokeEmuCore = NativeModules.PokeEmuCore as PokeEmuCoreNative;

export function setButton(button: GBAButton, pressed: boolean) {
  PokeEmuCore.setButtonState(button, pressed);
}
