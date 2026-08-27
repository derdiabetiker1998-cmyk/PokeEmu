import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TouchControls } from './TouchControls';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { useSettingsStore } from '../state/settings';

jest.mock('../native/PokeEmuCore', () => {
  const PokeEmuCore = { setButtonState: jest.fn(), setFastForward: jest.fn() };
  return {
    PokeEmuCore,
    // setButton() is a thin wrapper around PokeEmuCore.setButtonState() —
    // must be reimplemented here (not pulled in via requireActual) so it's
    // wired to this same mocked setButtonState, not the real native module.
    setButton: (button: string, pressed: boolean) => PokeEmuCore.setButtonState(button, pressed),
  };
});

describe('TouchControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ fastForwardSpeed: 2 });
  });

  it('sends pressed=true on pressIn for the A button', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('button-A'), 'pressIn');
    expect(PokeEmuCore.setButtonState).toHaveBeenCalledWith('A', true);
  });

  it('sends pressed=false on pressOut for the A button', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('button-A'), 'pressOut');
    expect(PokeEmuCore.setButtonState).toHaveBeenCalledWith('A', false);
  });

  it('sends Up on pressIn for the d-pad up region', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('dpad-Up'), 'pressIn');
    expect(PokeEmuCore.setButtonState).toHaveBeenCalledWith('Up', true);
  });

  it('enables fast-forward at the configured speed on pressIn, disables on pressOut', async () => {
    const { getByTestId } = await render(<TouchControls />);
    await fireEvent(getByTestId('button-FastForward'), 'pressIn');
    expect(PokeEmuCore.setFastForward).toHaveBeenCalledWith(true, 2);
    await fireEvent(getByTestId('button-FastForward'), 'pressOut');
    expect(PokeEmuCore.setFastForward).toHaveBeenCalledWith(false, 2);
  });
});
