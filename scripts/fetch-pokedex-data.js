// One-time data-prep script, not part of the app runtime.
// Fetches National Dex 1-1025 plus their Mega Evolutions and regional
// alternate forms (Alolan/Galarian/Hisuian/Paldean) from PokeAPI, downloads
// each variant's default sprite, and writes a consolidated manifest so the
// app can bundle everything and work fully offline. Deliberately excludes
// purely cosmetic variant sets (Vivillon patterns, Unown letters, Alcremie
// flavors, Pikachu cosplay, etc.) since those aren't "alternate forms" or
// "Mega Evolutions" in the sense asked for, and would balloon the dex into
// the thousands.
//
// Run once: node scripts/fetch-pokedex-data.js
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'pokedex');
const SPRITES_DIR = path.join(OUT_DIR, 'sprites');
const NATIONAL_DEX_SIZE = 1025;
const CONCURRENCY = 8;
const FORM_KEYWORDS = ['-mega', '-alola', '-galar', '-hisui', '-paldea'];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function downloadSprite(url, destPath) {
  if (fs.existsSync(destPath)) return; // resumable — skip what's already downloaded
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sprite fetch failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

async function buildEntry(dexNumber, speciesName, pokemonUrl, formLabel, isMega) {
  const pokemon = await fetchJson(pokemonUrl);
  const types = pokemon.types.map((t) => t.type.name);
  const spriteUrl = pokemon.sprites.front_default;
  const key = formLabel ? `${dexNumber}-${formLabel}` : `${dexNumber}`;
  const spriteFile = `${key}.png`;
  if (spriteUrl) {
    await downloadSprite(spriteUrl, path.join(SPRITES_DIR, spriteFile));
  }
  return {
    key,
    dexNumber,
    speciesName,
    formLabel,
    isMega,
    types,
    sprite: spriteUrl ? spriteFile : null,
  };
}

async function processSpecies(id) {
  const species = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  const englishName = species.names.find((n) => n.language.name === 'en')?.name || species.name;
  const results = [];

  const defaultVariety = species.varieties.find((v) => v.is_default) || species.varieties[0];
  results.push(await buildEntry(id, englishName, defaultVariety.pokemon.url, null, false));

  for (const variety of species.varieties) {
    if (variety.is_default) continue;
    const name = variety.pokemon.name;
    if (!FORM_KEYWORDS.some((k) => name.includes(k))) continue;
    const isMega = name.includes('-mega');
    const formLabel = name.slice(species.name.length + 1);
    results.push(await buildEntry(id, englishName, variety.pokemon.url, formLabel, isMega));
  }

  return results;
}

async function main() {
  fs.mkdirSync(SPRITES_DIR, { recursive: true });
  const allEntries = [];
  const ids = Array.from({ length: NATIONAL_DEX_SIZE }, (_, i) => i + 1);
  let completed = 0;

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((id) =>
        processSpecies(id).catch((err) => {
          console.error(`\nFailed species ${id}: ${err.message}`);
          return [];
        })
      )
    );
    for (const entries of batchResults) allEntries.push(...entries);
    completed += batch.length;
    process.stdout.write(`Species ${Math.min(completed, NATIONAL_DEX_SIZE)}/${NATIONAL_DEX_SIZE} (${allEntries.length} entries so far)\r`);
  }

  allEntries.sort((a, b) => a.dexNumber - b.dexNumber || (a.formLabel || '').localeCompare(b.formLabel || ''));
  fs.writeFileSync(path.join(OUT_DIR, 'pokedex.json'), JSON.stringify(allEntries, null, 2));
  console.log(`\nDone. ${allEntries.length} entries written to ${path.join(OUT_DIR, 'pokedex.json')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
