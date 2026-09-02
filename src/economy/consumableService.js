'use strict';
const shopService = require('./shopService');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Computes the stat effect of consuming one unit of `itemKey`.
 * Returns { stat: 'hp'|'stamina', amount, label } or null if this item has
 * no direct stat effect (future items — decorative, chests, special cards —
 * will fall through to null and need their own handling elsewhere).
 */
function computeEffect(itemKey) {
  const def = shopService.getItemDef(itemKey);
  if (!def) return null;

  if (itemKey === 'STAMINA_PILL') {
    return { stat: 'stamina', amount: def.restoreAmount, label: `⚡ +${def.restoreAmount} استامینا` };
  }

  if (itemKey === 'HEALING_POTION') {
    const amount = randInt(def.healMin, def.healMax);
    return { stat: 'hp', amount, label: `❤️ +${amount} سلامتی` };
  }

  return null;
}

module.exports = { computeEffect };
