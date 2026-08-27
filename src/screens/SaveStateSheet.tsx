import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { useSessionStore } from '../state/session';
import { theme } from '../theme/tokens';

const SLOTS = [1, 2, 3, 4];

export function SaveStateSheet({ onClose }: { onClose: () => void }) {
  const romId = useSessionStore((s) => s.activeRomId);

  const handleSave = async (slot: number) => {
    if (!romId) return;
    try {
      await PokeEmuCore.saveState(romId, slot);
      onClose();
    } catch {
      Alert.alert('Save failed', `Could not save to slot ${slot}.`);
    }
  };

  const handleLoad = async (slot: number) => {
    if (!romId) return;
    try {
      await PokeEmuCore.loadState(romId, slot);
      onClose();
    } catch {
      Alert.alert('Load failed', `Slot ${slot} may be empty or from an incompatible version.`);
    }
  };

  return (
    <View style={styles.sheet}>
      {SLOTS.map((slot) => (
        <View key={slot} style={styles.row}>
          <Text style={styles.slotLabel}>Slot {slot}</Text>
          <Pressable style={styles.actionButton} onPress={() => handleSave(slot)}>
            <Text style={styles.actionText}>Save</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => handleLoad(slot)}>
            <Text style={styles.actionText}>Load</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: theme.colors.glassSurfaceDark, borderRadius: theme.radii.lg, padding: theme.spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  slotLabel: { color: theme.colors.labelDark, flex: 1, ...theme.typography.body },
  actionButton: { backgroundColor: theme.colors.primary, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderRadius: theme.radii.pill },
  actionText: { color: '#FFFFFF', fontWeight: '600' },
});
