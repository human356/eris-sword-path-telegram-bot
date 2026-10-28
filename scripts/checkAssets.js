'use strict';
/** Lists which pictures from /assets are present and which expected ones are missing. */
const fs = require('fs');
const slots = require('../src/config/imageSlots');

const present = new Set(slots.listAssetSlotKeys());
const sections = [
  ['Profile templates', slots.listTemplateSlots().map((s) => s.key)],
  ['Item pictures', slots.listItemSlots().map((s) => s.key)],
  ['Shop banner', [slots.SHOP_BANNER_SLOT]],
  ['Battle result pictures', slots.listResultSlots().map((s) => s.key)],
  ['Level-up default', [slots.LEVEL_DEFAULT_SLOT]],
];
for (const [title, keys] of sections) {
  console.log(`\n${title}`);
  for (const key of keys) {
    const files = slots.assetCandidates(key).filter((f) => fs.existsSync(f));
    console.log(`  ${present.has(key) ? '✔' : '✘'} ${key}${files[0] ? `  <- ${files[0].replace(process.cwd(), '.')}` : ''}`);
  }
}
const lv = [...present].filter((k) => k.startsWith('level:') && k !== 'level:default');
console.log(`\nLevel pictures found: ${lv.length ? lv.join(', ') : 'none'} (files: assets/levels/<N>.png)`);

// Semi-pixel character layers (assets/character/<kind>/<id>.png) — all optional.
try {
  const layers = require('../src/character/renderer').listLayers();
  const keys = Object.keys(layers).sort();
  console.log(`\nCharacter art layers found: ${keys.length ? keys.length : 'none (the built-in pixel art is used)'}`);
  for (const k of keys) console.log(`  ✔ ${k}`);
} catch (err) {
  console.log('\nCharacter art layers: could not scan —', err.message);
}
