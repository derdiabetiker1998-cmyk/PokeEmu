import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { PokeEmuCore, setButton } from '../native/PokeEmuCore';
import { GBAButton } from '../native/buttons';
import { useSettingsStore } from '../state/settings';
import { theme } from '../theme/tokens';

function ControlButton({ button, label, testID }: { button: GBAButton; label: string; testID: string }) {
  return (
    <Pressable
      testID={testID}
      style={styles.roundButton}
      onPressIn={() => setButton(button, true)}
      onPressOut={() => setButton(button, false)}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

function DPadButton({ button, label, testID }: { button: GBAButton; label: string; testID: string }) {
  return (
    <Pressable
      testID={testID}
      style={styles.dpadButton}
      onPressIn={() => setButton(button, true)}
      onPressOut={() => setButton(button, false)}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export function TouchControls() {
  const fastForwardSpeed = useSettingsStore((s) => s.fastForwardSpeed);

  return (
    <View style={styles.container}>
      <View style={styles.dpad}>
        <DPadButton button={GBAButton.Up} label="▲" testID="dpad-Up" />
        <View style={styles.dpadRow}>
          <DPadButton button={GBAButton.Left} label="◀" testID="dpad-Left" />
          <DPadButton button={GBAButton.Right} label="▶" testID="dpad-Right" />
        </View>
        <DPadButton button={GBAButton.Down} label="▼" testID="dpad-Down" />
      </View>
      <View style={styles.faceButtons}>
        <ControlButton button={GBAButton.B} label="B" testID="button-B" />
        <ControlButton button={GBAButton.A} label="A" testID="button-A" />
      </View>
      <Pressable
        testID="button-FastForward"
        style={styles.roundButton}
        onPressIn={() => PokeEmuCore.setFastForward(true, fastForwardSpeed)}
        onPressOut={() => PokeEmuCore.setFastForward(false, fastForwardSpeed)}
      >
        <Text style={styles.buttonLabel}>{fastForwardSpeed}×</Text>
      </Pressable>
      <View style={styles.systemButtons}>
        <ControlButton button={GBAButton.Select} label="Select" testID="button-Select" />
        <ControlButton button={GBAButton.Start} label="Start" testID="button-Start" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing.lg },
  dpad: { alignItems: 'center' },
  dpadRow: { flexDirection: 'row', gap: theme.spacing.xl },
  dpadButton: {
    width: 44, height: 44, borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.glassSurfaceDark, alignItems: 'center', justifyContent: 'center',
  },
  faceButtons: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' },
  systemButtons: { flexDirection: 'row', gap: theme.spacing.sm, position: 'absolute', bottom: -theme.spacing.lg, alignSelf: 'center' },
  roundButton: {
    width: 56, height: 56, borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  buttonLabel: { color: '#FFFFFF', fontWeight: '700' },
});
