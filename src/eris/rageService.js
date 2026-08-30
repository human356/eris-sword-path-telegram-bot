'use strict';
const C = require('../config/constants');
const rageModel = require('../database/models/rageModel');
const eventModel = require('../database/models/eventModel');

function getRageLevel(rage) {
  for (const level of C.RAGE_LEVELS) {
    if (rage <= level.max) return level;
  }
  return C.RAGE_LEVELS[C.RAGE_LEVELS.length - 1];
}

/**
 * Adds rage to a group and returns { newRage, level, crossedThresholds, triggeredEvent }.
 * crossedThresholds lists any of 60/80/100 the group just passed, so callers
 * can fire the matching Eris line (spec §16).
 */
async function addRage(groupId, amount) {
  const before = await rageModel.getRage(groupId);
  const after = await rageModel.addRage(groupId, amount);

  const crossedThresholds = [];
  for (const t of [60, 80, 100]) {
    if (before < t && after >= t) crossedThresholds.push(t);
  }

  let triggeredEvent = null;
  if (after >= C.RAGE_MAX) {
    const existing = await eventModel.getActiveEvent(groupId);
    if (!existing) {
      triggeredEvent = await eventModel.createEvent(groupId, 'ERIS_CHALLENGE');
    }
  }

  return { newRage: after, level: getRageLevel(after), crossedThresholds, triggeredEvent };
}

module.exports = { addRage, getRageLevel };
