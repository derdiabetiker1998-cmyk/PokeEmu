import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { PokeEmuRenderView } from '../native/PokeEmuRenderView';
import { TouchControls } from '../controls/TouchControls';
import { useGamepadStatus } from '../controls/useGamepadStatus';
import { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../theme/tokens';

type EmulatorRoute = RouteProp<RootStackParamList, 'Emulator'>;

export function EmulatorScreen() {
  const route = useRoute<EmulatorRoute>();
  const connected = useGamepadStatus();

  useEffect(() => {
    let cancelled = false;
    PokeEmuCore.loadROM(route.params.filePath).then(() => {
      if (!cancelled) PokeEmuCore.play();
    });
    return () => {
      cancelled = true;
      PokeEmuCore.unloadROM();
    };
  }, [route.params.filePath]);

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
      <TouchControls />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.backgroundDark, alignItems: 'center', justifyContent: 'center' },
  screen: { width: 240 * 2, height: 160 * 2 },
  controllerBadge: { color: theme.colors.labelDark, ...theme.typography.caption, marginBottom: theme.spacing.sm },
});
