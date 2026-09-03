'use strict';
const C = require('../config/constants');
const engine = require('./battleEngine');
const shopService = require('../economy/shopService');

const CARD_MOVE_KEYS = [
  'METEOR_STRIKE', 'FIREBALL', 'DECEPTIVE_STRIKE', 'ICE_SHIELD', 'SYLPHY_HEAL',
  'MULTI_STRIKE', 'THUNDER_STRIKE', 'SWORD_PARRY', 'WALL_BREAKER',
];

function isSpecialMove(moveKey) {
  return CARD_MOVE_KEYS.includes(moveKey);
}

function getCardMoveDef(moveKey) {
  if (!isSpecialMove(moveKey)) return null;
  const def = shopService.getItemDef(moveKey);
  return def ? { ...def, key: moveKey } : null;
}

/** Stamina cost for ANY move — standard or special card. Undefined = invalid move. */
function getMoveStaminaCost(moveKey) {
  if (isSpecialMove(moveKey)) {
    const def = getCardMoveDef(moveKey);
    return def ? def.staminaCost : undefined;
  }
  return engine.STAMINA_COST[moveKey];
}

function isOffensiveMove(moveKey) {
  if (moveKey === engine.MOVES.ATTACK || moveKey === engine.MOVES.HEAVY_ATTACK) return true;
  const def = getCardMoveDef(moveKey);
  return !!(def && (def.damageMultiplier !== undefined || def.damagePercentOfMaxHp !== undefined));
}

function rollChance(p) {
  return Math.random() < p;
}

/**
 * Damage `attackerMove` deals to `defenderStats`, given the defender's own
 * chosen move this round (dodge/guard/ice-shield/counter/parry all react
 * here). One-directional — resolveMixedRound calls this twice.
 */
function computeOneDirection(attackerMove, attackerStats, defenderMove, defenderStats, defenderGuardBroken, who) {
  const log = [];
  const tags = {};

  if (!isOffensiveMove(attackerMove)) {
    if (attackerMove === 'ICE_SHIELD') {
      tags.selfDamage = getCardMoveDef('ICE_SHIELD').selfDamage;
    }
    if (attackerMove === 'WALL_BREAKER') {
      tags.breaksDefenderGuardNextRound = true;
    }
    return { dmg: 0, log, tags };
  }

  const cardDef = getCardMoveDef(attackerMove);
  const isHeavy = attackerMove === engine.MOVES.HEAVY_ATTACK;

  let dodged = false;
  if (defenderMove === engine.MOVES.DODGE) {
    const speedDiff = defenderStats.speed - attackerStats.speed;
    const dodgeChance = Math.min(0.75, Math.max(0.05, C.DODGE_BASE_CHANCE + speedDiff * 0.01));
    dodged = rollChance(dodgeChance);
  }

  const accuracy = cardDef ? (cardDef.accuracy ?? 0.9) : (isHeavy ? C.HEAVY_ATTACK_ACCURACY : C.ATTACK_ACCURACY);
  const hits = rollChance(accuracy) && !dodged;
  if (!hits) {
    log.push(`${who} حمله را از دست داد${dodged ? ' — جاخالی داده شد!' : '!'}`);
    return { dmg: 0, log, tags };
  }

  let dmg;
  if (cardDef && cardDef.damagePercentOfMaxHp) {
    dmg = Math.max(1, Math.round(defenderStats.maxHp * cardDef.damagePercentOfMaxHp));
  } else {
    const multiplier = cardDef ? (cardDef.damageMultiplier ?? 1) : (isHeavy ? C.HEAVY_ATTACK_DAMAGE_MULTIPLIER : 1);
    dmg = engine.baseDamage(attackerStats.attack, defenderStats.defense, multiplier);
  }

  if (rollChance(attackerStats.critChance)) {
    dmg = Math.round(dmg * C.CRIT_DAMAGE_MULTIPLIER);
    log.push(`${who} یک ضربهٔ بحرانی وارد کرد!`);
  }

  if (defenderMove === engine.MOVES.GUARD) {
    if (!defenderGuardBroken) {
      dmg = Math.round(dmg * (1 - C.GUARD_DAMAGE_REDUCTION));
      log.push(`حملهٔ ${who} تا حد زیادی دفاع شد.`);
    } else {
      log.push(`دفاع حریف نابود شده بود — حمله بی‌اثر نشد!`);
    }
  } else if (defenderMove === 'ICE_SHIELD') {
    if (!defenderGuardBroken) {
      dmg = 0;
      log.push(`🧊 سپر یخی حملهٔ ${who} را کاملاً خنثی کرد!`);
    } else {
      log.push(`سپر یخی نابود شده بود — حمله رد شد!`);
    }
  } else if (defenderMove === engine.MOVES.COUNTER) {
    tags.wasCountered = true;
    dmg = 0;
  } else if (defenderMove === 'SWORD_PARRY') {
    tags.wasParried = true;
    dmg = 0;
  }

  if (cardDef && cardDef.key === 'METEOR_STRIKE' && dmg > 0 && defenderStats.stamina < cardDef.executeThreshold) {
    if (rollChance(cardDef.executeChance)) {
      tags.execute = true;
      log.push(`☄️ حمله شهابی حریفی را که کاملاً بی‌رمق بود یک‌ضرب از پا انداخت!`);
    }
  }

  if (cardDef && cardDef.key === 'THUNDER_STRIKE') {
    tags.stunTarget = true;
    tags.selfDamage = cardDef.selfDamage;
  }

  return { dmg, log, tags };
}

/**
 * Resolves one round where at least one side used a special card. Only call
 * this when isSpecialMove(cMove) || isSpecialMove(oMove) — pure-standard
 * rounds should keep going through battleEngine.resolveRound unchanged.
 *
 * `context.challengerGuardBroken` / `context.opponentGuardBroken` — whether
 * that side's guard is nullified this round (from a WALL_BREAKER used last
 * round).
 *
 * Returns { aDamageDealt, bDamageDealt, log, effects } where effects =
 *   { selfDamageChallenger, selfDamageOpponent,
 *     instantKillChallenger, instantKillOpponent,
 *     stunChallenger, stunOpponent,
 *     guardBreakChallenger, guardBreakOpponent,
 *     extraStaminaCostChallenger, extraStaminaCostOpponent,
 *     fakeChallengerDisplayDamage, fakeOpponentDisplayDamage }
 */
function resolveMixedRound(cMove, cStats, oMove, oStats, context = {}) {
  const log = [];
  const effects = {
    selfDamageChallenger: 0, selfDamageOpponent: 0,
    instantKillChallenger: false, instantKillOpponent: false,
    stunChallenger: false, stunOpponent: false,
    guardBreakChallenger: false, guardBreakOpponent: false,
    extraStaminaCostChallenger: 0, extraStaminaCostOpponent: 0,
    fakeChallengerDisplayDamage: null, fakeOpponentDisplayDamage: null,
  };

  const a = computeOneDirection(cMove, cStats, oMove, oStats, context.opponentGuardBroken, 'A');
  const b = computeOneDirection(oMove, oStats, cMove, cStats, context.challengerGuardBroken, 'B');

  let aDamageDealt = a.dmg;
  let bDamageDealt = b.dmg;
  log.push(...a.log, ...b.log);

  if (a.tags.wasCountered) {
    bDamageDealt += Math.round(engine.baseDamage(oStats.attack, cStats.defense, 1) * C.COUNTER_DAMAGE_MULTIPLIER);
    log.push('ضدحمله! حریف به حملهٔ A پاسخ داد.');
  }
  if (b.tags.wasCountered) {
    aDamageDealt += Math.round(engine.baseDamage(cStats.attack, oStats.defense, 1) * C.COUNTER_DAMAGE_MULTIPLIER);
    log.push('ضدحمله! حریف به حملهٔ B پاسخ داد.');
  }
  if (a.tags.wasParried) effects.stunChallenger = true; // challenger's attack got parried -> challenger locked next round
  if (b.tags.wasParried) effects.stunOpponent = true;

  if (a.tags.execute) effects.instantKillOpponent = true;
  if (b.tags.execute) effects.instantKillChallenger = true;

  if (a.tags.selfDamage) effects.selfDamageChallenger += a.tags.selfDamage;
  if (b.tags.selfDamage) effects.selfDamageOpponent += b.tags.selfDamage;

  if (a.tags.stunTarget) effects.stunOpponent = true;
  if (b.tags.stunTarget) effects.stunChallenger = true;

  if (a.tags.breaksDefenderGuardNextRound) effects.guardBreakOpponent = true;
  if (b.tags.breaksDefenderGuardNextRound) effects.guardBreakChallenger = true;

  // Sword Parry whiff penalty: parried but nobody actually attacked you.
  if (cMove === 'SWORD_PARRY' && !isOffensiveMove(oMove)) {
    effects.extraStaminaCostChallenger += getCardMoveDef('SWORD_PARRY').parryStaminaPenalty;
    log.push('🤺 پری بی‌نتیجه بود — استقامت زیادی هدر رفت.');
  }
  if (oMove === 'SWORD_PARRY' && !isOffensiveMove(cMove)) {
    effects.extraStaminaCostOpponent += getCardMoveDef('SWORD_PARRY').parryStaminaPenalty;
    log.push('🤺 پری بی‌نتیجه بود — استقامت زیادی هدر رفت.');
  }

  // Multi-strike's splash needs extra targets that don't exist in a 1v1 duel.
  if (cMove === 'MULTI_STRIKE' || oMove === 'MULTI_STRIKE') {
    log.push('🌀 در دوئل دو نفره، حریف دیگری برای پخش آسیب کارت سورزنی وجود ندارد.');
  }

  // Deceptive Strike: real damage stands, but the round-report DISPLAYS a
  // lower, fake number to keep the opponent guessing.
  if (cMove === 'DECEPTIVE_STRIKE' && aDamageDealt > 0) {
    const def = getCardMoveDef('DECEPTIVE_STRIKE');
    effects.fakeChallengerDisplayDamage = Math.max(1, Math.round(aDamageDealt * (def.fakeReportMultiplier ?? 0.3)));
  }
  if (oMove === 'DECEPTIVE_STRIKE' && bDamageDealt > 0) {
    const def = getCardMoveDef('DECEPTIVE_STRIKE');
    effects.fakeOpponentDisplayDamage = Math.max(1, Math.round(bDamageDealt * (def.fakeReportMultiplier ?? 0.3)));
  }

  return { aDamageDealt, bDamageDealt, log, effects };
}

module.exports = {
  CARD_MOVE_KEYS, isSpecialMove, getCardMoveDef, getMoveStaminaCost, isOffensiveMove,
  computeOneDirection, resolveMixedRound,
};
