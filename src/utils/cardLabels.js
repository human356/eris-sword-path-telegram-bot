'use strict';
const shopService = require('../economy/shopService');

// The 5 starter moves every player begins with — these map 1:1 onto
// battleEngine.MOVES, so they never need an items.json entry.
const STARTER_CARD_LABELS = {
  ATTACK: '⚔️ حمله ساده',
  GUARD: '🛡 دفاع ساده',
  DODGE: '💨 جاخالی',
  HEAVY_ATTACK: '🔥 حمله سنگین',
  COUNTER: '⚡ ضدحمله',
};

/** Resolves a card key (starter move OR a purchased CARD item) to a display label. */
function getCardLabel(cardKey) {
  if (STARTER_CARD_LABELS[cardKey]) return STARTER_CARD_LABELS[cardKey];
  const def = shopService.getItemDef(cardKey);
  if (def) return `${def.emoji || '🎴'} ${def.label}`;
  return cardKey;
}

module.exports = { STARTER_CARD_LABELS, getCardLabel };
