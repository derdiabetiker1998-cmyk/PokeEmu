import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { importRom } from './importRom';
import { useRomLibraryStore } from './romLibrary';

jest.mock('expo-document-picker');
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/sandbox/',
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true }),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

describe('importRom', () => {
  beforeEach(() => {
    useRomLibraryStore.setState({ roms: [] });
    jest.clearAllMocks();
  });

  it('returns undefined (not null) when the user cancels the picker, so callers know not to alert', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true });
    const result = await importRom();
    expect(result).toBeUndefined();
    expect(useRomLibraryStore.getState().roms).toHaveLength(0);
  });

  it('copies a picked .gba file and adds it to the library', async () => {
    const header = Buffer.alloc(192, 0);
    header.writeUInt8(0x24, 0x04); // first byte of the standard GBA Nintendo logo header
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/emerald.gba', name: 'Pokemon - Emerald Version.gba' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(header.toString('base64'));
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

  it('rejects a .gba file whose header magic bytes are wrong', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/bad.gba', name: 'bad.gba' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(Buffer.alloc(192, 0).toString('base64'));
    const result = await importRom();
    expect(result).toBeNull();
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
  });

  it('accepts a .gba file with the correct Nintendo logo header bytes', async () => {
    const header = Buffer.alloc(192, 0);
    header.writeUInt8(0x24, 0x04); // first byte of the standard GBA Nintendo logo header
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///picked/good.gba', name: 'good.gba' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue(header.toString('base64'));
    const result = await importRom();
    expect(result).not.toBeNull();
  });
});
