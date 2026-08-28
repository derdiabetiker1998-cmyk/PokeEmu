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
  const lines = entries.map(
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
  console.log(`Wrote ${entries.length} sprite entries to ${OUT_PATH}`);
}

main();
