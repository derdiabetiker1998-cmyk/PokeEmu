import { useSettingsStore } from './settings';
import { GBAButton } from '../native/buttons';

describe('settings store', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      fastForwardSpeed: 2,
      soundEnabled: true,
      buttonMapping: {} as Record<GBAButton, string>,
    });
  });

  it('defaults fastForwardSpeed to 2x', () => {
    expect(useSettingsStore.getState().fastForwardSpeed).toBe(2);
  });

  it('updates fastForwardSpeed within 1-8x bounds', () => {
    useSettingsStore.getState().setFastForwardSpeed(4);
    expect(useSettingsStore.getState().fastForwardSpeed).toBe(4);
  });

  it('clamps fastForwardSpeed above 8 down to 8', () => {
    useSettingsStore.getState().setFastForwardSpeed(20);
    expect(useSettingsStore.getState().fastForwardSpeed).toBe(8);
  });

  it('toggles soundEnabled', () => {
    useSettingsStore.getState().setSoundEnabled(false);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });

  it('maps a GBA button to a controller button id', () => {
    useSettingsStore.getState().setButtonMapping(GBAButton.A, 'button_south');
    expect(useSettingsStore.getState().buttonMapping[GBAButton.A]).toBe('button_south');
  });
});
