import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRomLibraryStore, RomEntry } from './romLibrary';

const ROMS_DIR = `${FileSystem.documentDirectory}roms/`;

function titleFromFilename(name: string): string {
  return name.replace(/\.gba$/i, '');
}

export async function importRom(): Promise<RomEntry | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
  if (result.canceled || !result.assets?.[0]) {
    return null;
  }
  const asset = result.assets[0];
  if (!/\.gba$/i.test(asset.name)) {
    return null;
  }

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
