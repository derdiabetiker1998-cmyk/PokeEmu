// One-time cleanup pass over assets/pokedex/pokedex.json (run once, after
// fetch-pokedex-data.js). PokeAPI's live data turned out to be contaminated
// in ways a simple name/flag check couldn't catch:
//
// - Its `is_mega` flag (and matching "-mega" names) include long-standing
//   joke/April-Fools entries for Pokemon that never had a real Mega
//   Evolution in any released game (e.g. "baxcalibur-mega" — Gen 9 has no
//   Mega Evolutions at all; "absol-mega-z", "garchomp-mega-z" — fictional
//   second megas). Filtered down to the real, fixed, unchanging list of 46
//   species Game Freak actually gave a Mega Evolution (Charizard and
//   Mewtwo each keep their real X/Y pair).
// - "pikachu-alola-cap" matched the `-alola` keyword by coincidence — it's
//   one of Pikachu's promotional cap costumes, not a real Alolan form.
// - "-totem-" forms are giant battle-only sizes used in one Sun/Moon trial
//   battle, not a distinct creature worth its own dex-completion entry.
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'assets', 'pokedex', 'pokedex.json');
const SPRITES_DIR = path.join(__dirname, '..', 'assets', 'pokedex', 'sprites');

// The complete, fixed set of species with a real Mega Evolution across all
// released Pokemon games (Gen 6 XY/ORAS through Gen 7). This list will
// never grow — Game Freak has not added new Mega Evolutions since Gen 7.
const CANONICAL_MEGA_DEX_NUMBERS = new Set([
  3, 6, 9, 15, 18, 65, 80, 94, 115, 127, 130, 142, 150, 181, 208, 212, 214,
  229, 248, 254, 257, 260, 282, 302, 303, 306, 308, 310, 319, 323, 334, 354,
  359, 362, 373, 376, 380, 381, 384, 428, 445, 448, 460, 475, 531, 719,
]);

function isLegitMegaEntry(entry) {
  if (!CANONICAL_MEGA_DEX_NUMBERS.has(entry.dexNumber)) return false;
  // Charizard (6) and Mewtwo (150) are the only two with X/Y pairs — every
  // other real mega form is plain "mega", not "mega-x"/"mega-y"/"mega-z"/etc.
  if (entry.dexNumber === 6 || entry.dexNumber === 150) {
    return entry.formLabel === 'mega-x' || entry.formLabel === 'mega-y';
  }
  return entry.formLabel === 'mega';
}

function main() {
  const entries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const kept = [];
  const removed = [];

  for (const entry of entries) {
    if (entry.isMega && !isLegitMegaEntry(entry)) {
      removed.push(entry);
      continue;
    }
    if (entry.formLabel && (entry.formLabel.includes('totem') || entry.formLabel.includes('cap'))) {
      removed.push(entry);
      continue;
    }
    kept.push(entry);
  }

  for (const entry of removed) {
    if (entry.sprite) {
      const spritePath = path.join(SPRITES_DIR, entry.sprite);
      if (fs.existsSync(spritePath)) fs.unlinkSync(spritePath);
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(kept, null, 2));
  console.log(`Removed ${removed.length} contaminated entries: ${removed.map((e) => e.key).join(', ')}`);
  console.log(`${kept.length} entries remain.`);
}

main();
