import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { PokeEmuRenderView } from '../native/PokeEmuRenderView';
import { TouchControls } from '../controls/TouchControls';
import { useGamepadStatus } from '../controls/useGamepadStatus';
import { useSessionStore } from '../state/session';
import { SaveStateSheet } from './SaveStateSheet';
import { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../theme/tokens';

type EmulatorRoute = RouteProp<RootStackParamList, 'Emulator'>;
type EmulatorNavigation = NativeStackNavigationProp<RootStackParamList, 'Emulator'>;

export function EmulatorScreen() {
  const route = useRoute<EmulatorRoute>();
  const navigation = useNavigation<EmulatorNavigation>();
  const connected = useGamepadStatus();
  const [showSaveSheet, setShowSaveSheet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    useSessionStore.getState().setActiveRomId(route.params.romId);
    PokeEmuCore.loadROM(route.params.filePath).then(() => {
      if (!cancelled) PokeEmuCore.play();
    });
    return () => {
      cancelled = true;
      useSessionStore.getState().setActiveRomId(null);
      PokeEmuCore.unloadROM();
    };
  }, [route.params.filePath, route.params.romId]);

  useFocusEffect(
    React.useCallback(() => {
      PokeEmuCore.play();
      return () => PokeEmuCore.pause();
    }, [])
  );

  return (
    <View style={styles.container}>
      {connected && <Text style={styles.controllerBadge}>🎮 Connected</Text>}
      <PokeEmuRenderView style={styles.screen} />
      <View style={styles.toolbar}>
        <Pressable style={styles.saveStatesButton} onPress={() => setShowSaveSheet(true)}>
          <Text style={styles.saveStatesButtonText}>Save States</Text>
        </Pressable>
        <Pressable style={styles.saveStatesButton} onPress={() => navigation.navigate('CheatsEditor')}>
          <Text style={styles.saveStatesButtonText}>Cheats</Text>
        </Pressable>
      </View>
      {showSaveSheet && <SaveStateSheet onClose={() => setShowSaveSheet(false)} />}
      <TouchControls />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundDark, alignItems: 'center', justifyContent: 'center' },
  screen: { width: 240 * 2, height: 160 * 2 },
  controllerBadge: { color: theme.colors.labelDark, ...theme.typography.caption, marginBottom: theme.spacing.sm },
  toolbar: { flexDirection: 'row', gap: theme.spacing.sm },
  saveStatesButton: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.glassSurfaceDark,
  },
  saveStatesButtonText: { color: theme.colors.labelDark, ...theme.typography.caption, fontWeight: '600' },
});
