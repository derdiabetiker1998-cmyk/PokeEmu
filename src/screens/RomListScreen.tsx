import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert } from 'react-native';
import { useRomLibraryStore } from '../state/romLibrary';
import { importRom } from '../state/importRom';
import { theme } from '../theme/tokens';

type Props = {
  navigation: {
    navigate: {
      (screen: 'Emulator', params: { filePath: string; romId: string }): void;
      (screen: 'Settings'): void;
    };
  };
};

export function RomListScreen({ navigation }: Props) {
  const roms = useRomLibraryStore((s) => s.roms);

  const handleImport = async () => {
    const entry = await importRom();
    // entry === undefined means the user just cancelled the picker — not
    // an error, don't alert. entry === null means a file was picked but
    // rejected (wrong extension or bad header).
    if (entry === null) {
      Alert.alert('Import failed', 'That file could not be added — make sure it is a valid GBA ROM.');
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.settingsButtonText}>Settings</Text>
      </Pressable>
      {roms.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No ROMs yet.</Text>
          <Pressable style={styles.importButton} onPress={handleImport}>
            <Text style={styles.importButtonText}>Import a ROM</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={roms}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('Emulator', { filePath: item.filePath, romId: item.id })}
            >
              <Text style={styles.rowTitle}>{item.title}</Text>
            </Pressable>
          )}
          ListHeaderComponent={
            <Pressable style={styles.importButtonInline} onPress={handleImport}>
              <Text style={styles.importButtonText}>Import a ROM</Text>
            </Pressable>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  settingsButton: { alignSelf: 'flex-end', margin: theme.spacing.md },
  settingsButtonText: { ...theme.typography.body, color: theme.colors.primary, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  emptyText: { ...theme.typography.body, color: theme.colors.secondaryLabel },
  importButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
  },
  importButtonInline: {
    backgroundColor: theme.colors.primary,
    margin: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
  },
  importButtonText: { color: '#FFFFFF', ...theme.typography.body, fontWeight: '600' },
  row: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  rowTitle: { ...theme.typography.body, color: theme.colors.label },
});
