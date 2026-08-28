// Regenerates src/pokedex/spriteMap.ts from assets/pokedex/pokedex.json.
// Metro (React Native's bundler) needs static, literal require() calls for
// images — it can't resolve a dynamically-built path string at runtime — so
// this writes one require() per sprite into a generated lookup object keyed
// by each entry's `key`. Re-run after any change to assets/pokedex/pokedex.json.
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'assets', 'pokedex', 'pokedex.json');
const OUT_PATH = path.join(__dirname, '..', 'src', 'pokedex', 'spriteMap.ts');

function main() {
  const entries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  // fetch-pokedex-data.js allows `sprite: null` for a variety PokeAPI has no
  // front_default sprite for. Skip those here instead of emitting
  // require('.../sprites/null'), a require() of a nonexistent file that
  // would fail the whole Metro bundle rather than just that one entry.
  const withSprites = entries.filter((e) => e.sprite);
  const skipped = entries.length - withSprites.length;
  const lines = withSprites.map(
    (e) => `  '${e.key}': require('../../assets/pokedex/sprites/${e.sprite}'),`
  );
  const content = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-sprite-map.js
import { ImageSourcePropType } from 'react-native';

export const spriteMap: Record<string, ImageSourcePropType> = {
${lines.join('\n')}
};
`;
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, content);
  if (skipped > 0) console.warn(`Skipped ${skipped} entries with no sprite.`);
  console.log(`Wrote ${withSprites.length} sprite entries to ${OUT_PATH}`);
}

main();
