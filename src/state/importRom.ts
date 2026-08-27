import * as DocumentPicker from 'expo-document-picker';
// expo-file-system's default export replaced the classic promise-based API
// (documentDirectory/copyAsync/etc.) with a new File/Directory/Paths API in
// SDK 54+; those old names now throw at runtime from the default import.
// '/legacy' is Expo's own transitional subpath that still exports the
// classic API this module is written against.
import * as FileSystem from 'expo-file-system/legacy';
import { useRomLibraryStore, RomEntry } from './romLibrary';

function titleFromFilename(name: string): string {
  return name.replace(/\.gba$/i, '');
}

async function hasValidGbaHeader(uri: string): Promise<boolean> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, length: 192, position: 0 });
  const header = Buffer.from(base64, 'base64');
  // Byte 0x04 of a valid GBA ROM header begins the fixed Nintendo logo bitmap,
  // whose first byte is always 0x24.
  return header.length >= 5 && header[0x04] === 0x24;
}

// Returns `undefined` when the user simply cancelled the picker (not an
// error — the caller shouldn't alert), `null` when a file was picked but
// rejected (wrong extension or bad header — the caller should alert), or
// the imported entry on success.
export async function importRom(): Promise<RomEntry | null | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
  if (result.canceled || !result.assets?.[0]) {
    return undefined;
  }
  const asset = result.assets[0];
  if (!/\.gba$/i.test(asset.name)) {
    return null;
  }
  if (!(await hasValidGbaHeader(asset.uri))) {
    return null;
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('expo-file-system: documentDirectory is unavailable on this platform');
  }
  const ROMS_DIR = `${FileSystem.documentDirectory}roms/`;

  const dirInfo = await FileSystem.getInfoAsync(ROMS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(ROMS_DIR, { intermediates: true });
  }

  const destination = `${ROMS_DIR}${asset.name}`;
  await FileSystem.copyAsync({ from: asset.uri, to: destination });

  const entry: RomEntry = {
    id: destination,
    title: titleFromFilename(asset.name),
    filePath: destination,
    importedAt: Date.now(),
  };
  useRomLibraryStore.getState().addRom(entry);
  return entry;
}
