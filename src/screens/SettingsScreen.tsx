import React from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { useSettingsStore } from '../state/settings';
import { theme } from '../theme/tokens';

export function SettingsScreen() {
  const fastForwardSpeed = useSettingsStore((s) => s.fastForwardSpeed);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const setFastForwardSpeed = useSettingsStore((s) => s.setFastForwardSpeed);
  const setSoundEnabled = useSettingsStore((s) => s.setSoundEnabled);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Sound</Text>
        <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Fast-forward speed: {fastForwardSpeed}×</Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => setFastForwardSpeed(fastForwardSpeed - 1)} style={styles.stepperButton}>
            <Text style={styles.stepperText}>−</Text>
          </Pressable>
          <Pressable onPress={() => setFastForwardSpeed(fastForwardSpeed + 1)} style={styles.stepperButton}>
            <Text style={styles.stepperText}>+</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.md },
  label: { ...theme.typography.body, color: theme.colors.label },
  stepper: { flexDirection: 'row', gap: theme.spacing.sm },
  stepperButton: { width: 32, height: 32, borderRadius: theme.radii.sm, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  stepperText: { color: '#FFFFFF', fontWeight: '700', fontSize: 18 },
});
