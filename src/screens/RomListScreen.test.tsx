import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { RomListScreen } from './RomListScreen';
import { useRomLibraryStore } from '../state/romLibrary';
import * as importRomModule from '../state/importRom';

jest.mock('../state/importRom');

describe('RomListScreen', () => {
  beforeEach(() => {
    useRomLibraryStore.setState({ roms: [] });
    jest.clearAllMocks();
  });

  it('shows an empty state with an import button when the library is empty', async () => {
    const { getByText } = await render(<RomListScreen navigation={{ navigate: jest.fn() } as any} />);
    expect(getByText(/import a rom/i)).toBeTruthy();
  });

  it('lists imported roms by title', async () => {
    useRomLibraryStore.setState({
      roms: [{ id: '1', title: 'Pokemon - Emerald Version', filePath: '/roms/e.gba', importedAt: 1 }],
    });
    const { getByText } = await render(<RomListScreen navigation={{ navigate: jest.fn() } as any} />);
    expect(getByText('Pokemon - Emerald Version')).toBeTruthy();
  });

  it('calls importRom when the import button is pressed', async () => {
    (importRomModule.importRom as jest.Mock).mockResolvedValue(null);
    const { getByText } = await render(<RomListScreen navigation={{ navigate: jest.fn() } as any} />);
    await fireEvent.press(getByText(/import a rom/i));
    await waitFor(() => expect(importRomModule.importRom).toHaveBeenCalled());
  });

  it('navigates to Emulator with the filePath when a row is pressed', async () => {
    useRomLibraryStore.setState({
      roms: [{ id: '1', title: 'Emerald', filePath: '/roms/e.gba', importedAt: 1 }],
    });
    const navigate = jest.fn();
    const { getByText } = await render(<RomListScreen navigation={{ navigate } as any} />);
    await fireEvent.press(getByText('Emerald'));
    expect(navigate).toHaveBeenCalledWith('Emulator', { filePath: '/roms/e.gba', romId: '1' });
  });
});
