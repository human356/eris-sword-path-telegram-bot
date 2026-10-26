'use strict';
/** Lists which pictures from /assets are present and which expected ones are missing. */
const fs = require('fs');
const slots = require('../src/config/imageSlots');

const present = new Set(slots.listAssetSlotKeys());
const sections = [
  ['Profile templates', slots.listTemplateSlots().map((s) => s.key)],
  ['Item pictures', slots.listItemSlots().map((s) => s.key)],
  ['Shop banner', [slots.SHOP_BANNER_SLOT]],
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
