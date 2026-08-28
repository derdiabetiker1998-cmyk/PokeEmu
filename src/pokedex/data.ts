import pokedexData from '../../assets/pokedex/pokedex.json';
import { spriteMap } from './spriteMap';

type PokedexDataEntry = {
  key: string;
  dexNumber: number;
  speciesName: string;
  formLabel: string | null;
  isMega: boolean;
  types: string[];
  sprite: string | null;
};

export type PokedexEntry = Omit<PokedexDataEntry, 'sprite'>;

// fetch-pokedex-data.js allows `sprite: null` for a variety PokeAPI has no
// front_default sprite for — generate-sprite-map.js skips those too, so
// filter them out here rather than including a dex entry PokedexScreen
// couldn't render an Image for.
export const pokedexEntries: PokedexEntry[] = (pokedexData as PokedexDataEntry[]).filter(
  (e) => e.sprite
);

export function spriteForEntry(key: string) {
  return spriteMap[key];
}

export function displayName(entry: PokedexEntry): string {
  if (!entry.formLabel) return entry.speciesName;
  if (entry.isMega) {
    const suffix = entry.formLabel === 'mega-x' ? ' (Mega X)' : entry.formLabel === 'mega-y' ? ' (Mega Y)' : ' (Mega)';
    return `${entry.speciesName}${suffix}`;
  }
  // Use the full label, not just the region — some species have multiple
  // distinct forms sharing a region prefix (e.g. Tauros's Paldean
  // aqua-breed/blaze-breed/combat-breed are three separate catchable
  // entries; truncating to the first segment would show all three as the
  // same "(Paldea)" name).
  const formattedForm = entry.formLabel
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `${entry.speciesName} (${formattedForm})`;
}
