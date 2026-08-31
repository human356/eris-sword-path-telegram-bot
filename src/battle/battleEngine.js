'use strict';
const C = require('../config/constants');

const MOVES = Object.freeze({
  ATTACK: 'ATTACK',
  GUARD: 'GUARD',
  DODGE: 'DODGE',
  HEAVY_ATTACK: 'HEAVY_ATTACK',
  COUNTER: 'COUNTER',
});

const STAMINA_COST = {
  [MOVES.ATTACK]: C.ATTACK_STAMINA_COST,
  [MOVES.GUARD]: C.GUARD_STAMINA_COST,
  [MOVES.DODGE]: C.DODGE_STAMINA_COST,
  [MOVES.HEAVY_ATTACK]: C.HEAVY_ATTACK_STAMINA_COST,
  [MOVES.COUNTER]: C.COUNTER_STAMINA_COST,
};

function affordableMoves(stamina) {
  return Object.entries(STAMINA_COST)
    .filter(([, cost]) => stamina >= cost)
    .map(([move]) => move);
}

function rollChance(p) {
  return Math.random() < p;
}

/**
 * Computes raw attack damage for an attacker vs defender's Defense stat.
 * Defense reduces damage but never to zero, so fights always progress.
 */
function baseDamage(attackerAttack, defenderDefense, powerMultiplier = 1) {
  const raw = attackerAttack * powerMultiplier - defenderDefense * 0.5;
  return Math.max(3, Math.round(raw));
}

/**
 * Resolves one simultaneous pair of moves.
 * `a` and `b` are { attack, defense, speed, critChance, stamina, hp } style stat snapshots.
 * Returns { aDamageDealt, bDamageDealt, log: string[] }.
 * Damage dealt is always FROM the mover TO the opponent; e.g. aDamageDealt is
 * damage dealt by player A onto player B.
 */
function resolveRound(aMove, aStats, bMove, bStats) {
  const log = [];
  let aDamageDealt = 0; // A -> B
  let bDamageDealt = 0; // B -> A

  const isOffensive = (m) => m === MOVES.ATTACK || m === MOVES.HEAVY_ATTACK;

  function resolveOneDirection(move, attacker, defenderMove, defender, who) {
    if (move === MOVES.GUARD) {
      return 0; // guard deals no damage itself
    }
    if (move === MOVES.DODGE) {
      return 0; // dodge is purely defensive
    }
    if (move === MOVES.COUNTER) {
      // Counter only pays off if the opponent attacked; handled at pair level.
      return 0;
    }

    // ATTACK or HEAVY_ATTACK
    const isHeavy = move === MOVES.HEAVY_ATTACK;
    const accuracy = isHeavy ? C.HEAVY_ATTACK_ACCURACY : C.ATTACK_ACCURACY;

    // Defender dodge chance scales with defender speed advantage.
    let dodged = false;
    if (defenderMove === MOVES.DODGE) {
      const speedDiff = defender.speed - attacker.speed;
      const dodgeChance = Math.min(0.75, Math.max(0.05, C.DODGE_BASE_CHANCE + speedDiff * 0.01));
      dodged = rollChance(dodgeChance);
    }

    const hits = rollChance(accuracy) && !dodged;
    if (!hits) {
      log.push(`${who} حمله را از دست داد${dodged ? ' — جاخالی داده شد!' : '!'}`);
      return 0;
    }

    let dmg = baseDamage(
      attacker.attack, defender.defense,
      isHeavy ? C.HEAVY_ATTACK_DAMAGE_MULTIPLIER : 1
    );

    const isCrit = rollChance(attacker.critChance);
    if (isCrit) {
      dmg = Math.round(dmg * C.CRIT_DAMAGE_MULTIPLIER);
      log.push(`${who} یک ضربهٔ بحرانی وارد کرد!`);
    }

    if (defenderMove === MOVES.GUARD) {
      dmg = Math.round(dmg * (1 - C.GUARD_DAMAGE_REDUCTION));
      log.push(`حملهٔ ${who} تا حد زیادی دفاع شد.`);
    }

    return dmg;
  }

  // Counter logic: if defender chose COUNTER and attacker chose an offensive move,
  // the counter lands hard instead of the attacker's hit landing normally.
  function withCounterAdjustment(moverMove, mover, opponentMove, opponent, who) {
    if (opponentMove === MOVES.COUNTER && isOffensive(moverMove)) {
      // Opponent successfully counters the incoming attack.
      const dmg = Math.round(
        baseDamage(opponent.attack, mover.defense, 1) * C.COUNTER_DAMAGE_MULTIPLIER
      );
      log.push(`ضدحمله! ${who === 'A' ? 'B' : 'A'} به حمله پاسخ می‌دهد.`);
      return { moverDeals: 0, counterDeals: dmg };
    }
    return null;
  }

  // If mover chose COUNTER but opponent did NOT attack, the counter fails and
  // wastes stamina with a small self-punish (spec §10: "in case of a mistake, takes damage").
  function counterWhiff(moverMove, opponentMove, who) {
    if (moverMove === MOVES.COUNTER && !isOffensive(opponentMove)) {
      log.push(`ضدحملهٔ ${who} بی‌نتیجه بود — کاملاً بی‌دفاع ماند.`);
      return baseDamage(4, 0, 1); // small punish damage
    }
    return 0;
  }

  const counterFromB = withCounterAdjustment(aMove, aStats, bMove, bStats, 'A');
  const counterFromA = withCounterAdjustment(bMove, bStats, aMove, aStats, 'B');

  if (counterFromB) {
    // A attacked into B's counter: A deals 0, B's counter deals to A.
    bDamageDealt += counterFromB.counterDeals;
  } else {
    aDamageDealt += resolveOneDirection(aMove, aStats, bMove, bStats, 'A');
  }

  if (counterFromA) {
    aDamageDealt += counterFromA.counterDeals;
  } else if (!counterFromB) {
    bDamageDealt += resolveOneDirection(bMove, bStats, aMove, aStats, 'B');
  }

  aDamageDealt += counterWhiff(aMove, bMove, 'A');
  bDamageDealt += counterWhiff(bMove, aMove, 'B');

  return { aDamageDealt, bDamageDealt, log };
}

/** Picks a defensive fallback move for an AFK player (spec §12, §29). */
function autoDefensiveMove(stamina) {
  if (stamina >= STAMINA_COST[MOVES.GUARD]) return MOVES.GUARD;
  return null; // truly no stamina — treated as a forced miss with 0 cost
}

module.exports = { MOVES, STAMINA_COST, affordableMoves, resolveRound, autoDefensiveMove, baseDamage };
