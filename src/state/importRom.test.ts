import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { importRom } from './importRom';
import { useRomLibraryStore } from './romLibrary';

jest.mock('expo-document-picker');
jest.mock('expo-file-system', () => ({
  documentDirectory: '/sandbox/',
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
}));

describe('importRom', () => {
  beforeEach(() => {
    useRomLibraryStore.setState({ roms: [] });
    jest.clearAllMocks();
  });

  it('returns null when the user cancels the picker', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
    const result = await importRom();
    expect(result).toBeNull();
    expect(useRomLibraryStore.getState().roms).toHaveLength(0);
  });

  it('copies a picked .gba file and adds it to the library', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/emerald.gba', name: 'Pokemon - Emerald Version.gba' }],
    });
    const result = await importRom();
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///picked/emerald.gba',
      to: '/sandbox/roms/Pokemon - Emerald Version.gba',
    });
    expect(result?.title).toBe('Pokemon - Emerald Version');
    expect(useRomLibraryStore.getState().roms).toHaveLength(1);
  });

  it('rejects a file that is not a .gba extension', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/notarom.txt', name: 'notarom.txt' }],
    });
    const result = await importRom();
    expect(result).toBeNull();
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  });
});
