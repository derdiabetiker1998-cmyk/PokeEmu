import pokedexData from '../../assets/pokedex/pokedex.json';
import { spriteMap } from './spriteMap';

export type PokedexEntry = {
  key: string;
  dexNumber: number;
  speciesName: string;
  formLabel: string | null;
  isMega: boolean;
  types: string[];
};

export const pokedexEntries: PokedexEntry[] = pokedexData;

export function spriteForEntry(key: string) {
  return spriteMap[key];
}

export function displayName(entry: PokedexEntry): string {
  if (!entry.formLabel) return entry.speciesName;
  if (entry.isMega) {
    const suffix = entry.formLabel === 'mega-x' ? ' (Mega X)' : entry.formLabel === 'mega-y' ? ' (Mega Y)' : ' (Mega)';
    return `${entry.speciesName}${suffix}`;
  }
  const region = entry.formLabel.split('-')[0];
  const regionLabel = region.charAt(0).toUpperCase() + region.slice(1);
  return `${entry.speciesName} (${regionLabel})`;
}
