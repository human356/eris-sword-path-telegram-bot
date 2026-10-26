'use strict';
/**
 * Renders sample profile cards WITHOUT Telegram or a database, so you can look at
 * the layout while designing templates:
 *     npm run preview:card                (all templates found / built-in fallback)
 *     npm run preview:card -- TPL_FLAME   (one template)
 * Output: ./preview/<template>.jpg
 */
const fs = require('fs');
const path = require('path');
const slots = require('../src/config/imageSlots');
const { renderCardBuffer } = require('../src/services/profileCardService');

const vmFor = (templateKey) => ({
  name: 'سارا رضایی',
  username: '@sara_blade',
  level: 27,
  xpPct: 64,
  rank: 'Sword Adept',
  templateKey,
  title: 'شاگرد شمشیر',
  ownedTitles: ['شاگرد شمشیر', 'مورد علاقهٔ اریس'],
  showcase: [
    { key: 'FRAME_GOLDEN', label: 'قاب طلایی' },
    { key: 'BADGE_UNDEFEATED', label: 'نشان شکست‌ناپذیر' },
    null,
  ],
  stats: {
    attack: 48, defense: 35, speed: 29, crit: '12%', maxHp: 420, maxStamina: 160,
    rating: '1,284', winRate: '63%', wins: '57', losses: '33', streak: 4, respect: '1,920',
  },
});

(async () => {
  const only = process.argv[2];
  const keys = only ? [only] : [slots.DEFAULT_TEMPLATE_KEY, ...slots.profileTemplateKeys()];
  const outDir = path.join(__dirname, '..', 'preview');
  fs.mkdirSync(outDir, { recursive: true });

  for (const key of keys) {
    const files = slots.assetCandidates(slots.templateSlot(key)).filter((f) => fs.existsSync(f));
    const assets = { template: files[0] ? fs.readFileSync(files[0]) : null, items: {} };
    const buf = await renderCardBuffer(vmFor(key), assets);
    const out = path.join(outDir, `${key}.jpg`);
    fs.writeFileSync(out, buf);
    console.log(`${key}: ${out} (${files[0] ? 'with template picture' : 'built-in background'})`);
  }
})().catch((err) => {
  console.error(err.message === 'PROFILE_CARD_UNAVAILABLE' ? 'Install dependencies first: npm install' : err);
  process.exit(1);
});
