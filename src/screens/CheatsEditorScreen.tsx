import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, Switch, StyleSheet } from 'react-native';
import { useCheatsStore } from '../state/cheatsStore';
import { useSessionStore } from '../state/session';
import { parseGameSharkCode } from '../cheats/gameSharkParser';
import { PokeEmuCore } from '../native/PokeEmuCore';
import { theme } from '../theme/tokens';

export function CheatsEditorScreen() {
  const romId = useSessionStore((s) => s.activeRomId);
  const codes = useCheatsStore((s) => (romId ? s.codesByRom[romId] ?? [] : []));
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const { valid, normalized } = parseGameSharkCode(input);
    if (!valid || !romId) {
      setError('Enter a valid 16-digit GameShark code');
      return;
    }
    setError(null);
    useCheatsStore.getState().addCode(romId, normalized);
    await PokeEmuCore.applyCheat(normalized, true);
    setInput('');
  };

  const handleToggle = async (code: string, enabled: boolean) => {
    if (!romId) return;
    useCheatsStore.getState().setEnabled(romId, code, enabled);
    await PokeEmuCore.applyCheat(code, enabled);
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="XXXXXXXX YYYYYYYY"
        value={input}
        onChangeText={setInput}
        autoCapitalize="characters"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.addButton} onPress={handleAdd}>
        <Text style={styles.addButtonText}>Add Code</Text>
      </Pressable>
      <FlatList
        data={codes}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.codeText}>{item.code}</Text>
            <Switch value={item.enabled} onValueChange={(v) => handleToggle(item.code, v)} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, padding: theme.spacing.md },
  input: {
    borderWidth: 1, borderColor: theme.colors.secondaryLabel, borderRadius: theme.radii.md,
    padding: theme.spacing.sm, ...theme.typography.body,
  },
  error: { color: theme.colors.primaryDark, marginTop: theme.spacing.xs },
  addButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill, padding: theme.spacing.sm, alignItems: 'center', marginVertical: theme.spacing.sm },
  addButtonText: { color: '#FFFFFF', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm },
  codeText: { ...theme.typography.body, color: theme.colors.label },
});
