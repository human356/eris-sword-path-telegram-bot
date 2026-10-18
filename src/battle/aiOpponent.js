'use strict';
const engine = require('./battleEngine');
const specialCards = require('./specialCards');
const C = require('../config/constants');

const DIFFICULTIES = Object.freeze({ EASY: 'EASY', MEDIUM: 'MEDIUM', HARD: 'HARD' });
const STARTER_MOVES = ['ATTACK', 'GUARD', 'DODGE', 'HEAVY_ATTACK', 'COUNTER'];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Virtual item stock the bot carries into the fight (spec §10). Kept in memory, not DB. */
function initialAiSupplies(difficulty) {
  if (difficulty === DIFFICULTIES.EASY) return { potions: 0, pills: 0 };
  if (difficulty === DIFFICULTIES.MEDIUM) return { potions: randInt(1, 5), pills: randInt(1, 3) };
  return { potions: randInt(5, 12), pills: 6 };
}

/**
 * A random per-round miss chance layered on top of the bot's move (spec §10:
 * "احتمال خطای خطی از سمت سرور"). Implemented as: if the roll hits, the bot's
 * intended offensive move is swapped for GUARD instead of firing — simplest
 * way to express "the server fumbled" without touching the shared damage
 * engine's own internal accuracy rolls.
 */
function rollsAMiss(difficulty) {
  if (difficulty === DIFFICULTIES.EASY) return Math.random() < C.PVE_EASY_FUMBLE_CHANCE;
  if (difficulty === DIFFICULTIES.MEDIUM) return Math.random() < Math.random() * 0.05;
  return false; // HARD: no miss chance at all
}

/**
 * The bot's available move pool. HARD mirrors the human player's own
 * equipped loadout (spec §10: "هر کارت مبارزه‌ای که کاربر استفاده می‌کند هم
 * سرور... دارد"); EASY/MEDIUM just use the 5 starter moves.
 */
function movePoolFor(difficulty, playerLoadout) {
  return difficulty === DIFFICULTIES.HARD ? playerLoadout : STARTER_MOVES;
}

function chooseAiMove(difficulty, aiParticipant, playerLoadout) {
  const pool = movePoolFor(difficulty, playerLoadout);
  const affordable = pool.filter((m) => {
    const cost = specialCards.getMoveStaminaCost(m);
    return cost !== undefined && cost <= aiParticipant.stamina;
  });
  if (affordable.length === 0) return null; // truly can't act this round

  if (rollsAMiss(difficulty) && affordable.includes(engine.MOVES.GUARD)) {
    return engine.MOVES.GUARD;
  }

  const offensive = affordable.filter((m) => specialCards.isOffensiveMove(m));
  const aggression = difficulty === DIFFICULTIES.EASY ? C.PVE_EASY_AGGRESSION : 0.7;
  const pool2 = offensive.length && Math.random() < aggression ? offensive : affordable;
  return pool2[Math.floor(Math.random() * pool2.length)];
}

/**
 * Called once per round before the bot's move is decided — lets it react to
 * its own critical HP/stamina (spec §10: "باید در زمان حساس... استفاده
 * کند"). Mutates `supplies` in place. Returns a report line or null.
 */
function maybeUseSupplies(difficulty, supplies, aiParticipant) {
  // EASY: Eris never drinks potions / uses stamina pills (or any other recovery).
  if (difficulty === DIFFICULTIES.EASY) return null;

  const hpRatio = aiParticipant.hp / aiParticipant.max_hp;
  if (hpRatio < 0.3 && supplies.potions > 0) {
    supplies.potions -= 1;
    const heal = randInt(45, 64);
    return { stat: 'hp', amount: heal, label: `اریس یک معجون درمان نوشید (+${heal} سلامتی)` };
  }
  if (aiParticipant.stamina < 20 && supplies.pills > 0) {
    supplies.pills -= 1;
    return { stat: 'stamina', amount: 40, label: 'اریس یک قرص استامینا مصرف کرد (+۴۰ استقامت)' };
  }
  return null;
}

module.exports = { DIFFICULTIES, STARTER_MOVES, initialAiSupplies, chooseAiMove, maybeUseSupplies };
