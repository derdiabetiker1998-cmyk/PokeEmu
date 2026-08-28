import React from 'react';
import { View, Text, FlatList, Pressable, Image, StyleSheet } from 'react-native';
import { pokedexEntries, spriteForEntry, displayName } from '../pokedex/data';
import { usePokedexProgressStore } from '../state/pokedexProgress';
import { theme } from '../theme/tokens';

export function PokedexScreen() {
  const caught = usePokedexProgressStore((s) => s.caught);
  const toggleCaught = usePokedexProgressStore((s) => s.toggleCaught);
  const caughtCount = pokedexEntries.filter((e) => caught[e.key]).length;

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <Text style={styles.progressText}>
          {caughtCount} / {pokedexEntries.length} caught
        </Text>
      </View>
      <FlatList
        data={pokedexEntries}
        keyExtractor={(item) => item.key}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const isCaught = !!caught[item.key];
          return (
            <Pressable
              style={[styles.cell, isCaught && styles.cellCaught]}
              onPress={() => toggleCaught(item.key)}
              accessibilityRole="button"
              accessibilityLabel={displayName(item)}
            >
              <Image source={spriteForEntry(item.key)} style={[styles.sprite, !isCaught && styles.spriteUncaught]} />
              <Text style={styles.dexNumber}>#{String(item.dexNumber).padStart(4, '0')}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {displayName(item)}
              </Text>
              {isCaught && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  progressBar: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.secondaryLabel,
  },
  progressText: { ...theme.typography.title, color: theme.colors.label, textAlign: 'center' },
  grid: { padding: theme.spacing.sm },
  cell: {
    flex: 1 / 3,
    margin: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    position: 'relative',
  },
  cellCaught: { backgroundColor: '#FFF6D9' },
  sprite: { width: 64, height: 64 },
  spriteUncaught: { opacity: 0.35 },
  dexNumber: { ...theme.typography.caption, color: theme.colors.secondaryLabel },
  name: { ...theme.typography.caption, color: theme.colors.label, fontWeight: '600' },
  checkmark: {
    position: 'absolute',
    top: 4,
    right: 8,
    color: theme.colors.primary,
    fontWeight: '700',
    fontSize: 16,
  },
});
