'use strict';
const C = require('../config/constants');
const mpModel = require('../database/models/multiplayerBattleModel');
const playerStatsModel = require('../database/models/playerStatsModel');
const inventoryModel = require('../database/models/inventoryModel');
const cardLoadoutModel = require('../database/models/cardLoadoutModel');
const xpService = require('../ranking/xpService');
const coinService = require('../economy/coinService');
const shopService = require('../economy/shopService');
const consumableService = require('../economy/consumableService');

const engine = require('./battleEngine');
const specialCards = require('./specialCards');
const aiOpponent = require('./aiOpponent');
const { getCardLabel } = require('../utils/cardLabels');
const { num, escapeHtml } = require('../utils/format');
const { lobbyKeyboard, oneVsOneMoveKeyboard, ffaMoveKeyboard } = require('../bot/keyboardsMultiplayer');
// Phase 6: group-chat message cleanup. sendAutoDelete = default for most
// messages this module sends (lobby chatter, round move-prompts). sendPersist
// = this module's 2 exceptions: the per-round report (resolvePveRound /
// resolveTeamRound / resolveFfaRound) and the final result
// (resolvePveRound's "🏁" branch + finishMultiplayerBattle).
const { sendAutoDelete, sendPersist } = require('../utils/messageCleanup');
const { threadExtra } = require('../utils/topic');

const roundTimers = new Map();
const recruitTimers = new Map();
// battleId -> { [telegramId]: { move, target: telegramId|null, submittedAt } }
const pendingMoves = new Map();
const pendingItems = new Map(); // battleId -> { [telegramId]: string[] }
const pveSupplies = new Map(); // battleId -> { potions, pills } (bot's virtual stock)

function clearTimer(map, id) {
  const t = map.get(id);
  if (t) { clearTimeout(t); map.delete(id); }
}

function clearRoundBookkeeping(battleId) {
  pendingMoves.delete(battleId);
  pendingItems.delete(battleId);
}

/** Resolves a plain 1v1 exchange (used by PVE and by each round's TEAM champions). */
function resolveOneVsOne(moveA, statsA, moveB, statsB) {
  const useSpecial = specialCards.isSpecialMove(moveA) || specialCards.isSpecialMove(moveB);
  if (moveA && moveB) {
    if (useSpecial) return specialCards.resolveMixedRound(moveA, statsA, moveB, statsB, {});
    const r = engine.resolveRound(moveA, statsA, moveB, statsB);
    return { aDamageDealt: r.aDamageDealt, bDamageDealt: r.bDamageDealt, log: r.log, effects: {} };
  }
  if (moveA && !moveB) {
    if (specialCards.isSpecialMove(moveA)) return specialCards.resolveMixedRound(moveA, statsA, engine.MOVES.GUARD, statsB, {});
    const r = engine.resolveRound(moveA, statsA, engine.MOVES.GUARD, statsB);
    return { aDamageDealt: r.aDamageDealt, bDamageDealt: 0, log: r.log, effects: {} };
  }
  if (!moveA && moveB) {
    if (specialCards.isSpecialMove(moveB)) return specialCards.resolveMixedRound(engine.MOVES.GUARD, statsA, moveB, statsB, {});
    const r = engine.resolveRound(engine.MOVES.GUARD, statsA, moveB, statsB);
    return { aDamageDealt: 0, bDamageDealt: r.bDamageDealt, log: r.log, effects: {} };
  }
  return { aDamageDealt: 0, bDamageDealt: 0, log: ['هر دو طرف بی‌واکنش ماندند.'], effects: {} };
}

function combatStatsOf(playerRow) {
  return { attack: playerRow.attack, defense: playerRow.defense, speed: playerRow.speed, critChance: Number(playerRow.crit_chance) };
}

function isLateRound(battle) {
  return battle.round_number >= battle.max_rounds - 1; // last 2 rounds: no healing items (spec §9, generalized)
}

function createMultiplayerBattleManager(bot) {
  // ============================== LOBBY (FFA / TEAM) ==============================

  async function startRecruiting(type, groupId, chatId, initiatorUser, threadId = 0) {
    const maxRounds = type === mpModel.TYPES.TEAM ? C.TEAM_MAX_ROUNDS : C.FFA_MAX_ROUNDS;
    const battle = await mpModel.createBattle({
      groupId, type, maxRounds, initiatorId: initiatorUser.telegramId, recruitSeconds: C.MULTIPLAYER_RECRUIT_SECONDS, threadId,
    });

    const stats = (await playerStatsModel.getOrCreatePlayerStats(initiatorUser.telegramId, groupId)).stats;
    await mpModel.addParticipant({
      battleId: battle.id, telegramId: initiatorUser.telegramId, displayName: initiatorUser.displayName,
      hp: stats.hp, maxHp: stats.max_hp, stamina: stats.stamina, maxStamina: stats.max_stamina,
    });

    const label = type === mpModel.TYPES.TEAM ? 'نبرد تیمی' : 'نبرد آزاد چندنفره';
    const minP = type === mpModel.TYPES.TEAM ? C.TEAM_MIN_PLAYERS : C.FFA_MIN_PLAYERS;
    const maxP = type === mpModel.TYPES.TEAM ? C.TEAM_MAX_PLAYERS : C.FFA_MAX_PLAYERS;

    const text =
      `⚔️ <b>${label}</b>\n\n${escapeHtml(initiatorUser.displayName)} یک ${label} باز کرد!\n\n` +
      `👥 بازیکنان: ${escapeHtml(initiatorUser.displayName)} (۱ نفر)\n` +
      `نیاز: حداقل ${minP}، حداکثر ${maxP} نفر\n\n` +
      `برای پیوستن دکمهٔ زیر را بزنید. ${Math.round(C.MULTIPLAYER_RECRUIT_SECONDS / 60)} دقیقه فرصت هست.`;

    const sent = await sendAutoDelete(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(threadId), ...lobbyKeyboard(battle.id) });
    await mpModel.setChatMessageId(battle.id, sent.message_id);

    recruitTimers.set(battle.id, setTimeout(() => resolveRecruitTimeout(battle.id, chatId).catch(() => {}), C.MULTIPLAYER_RECRUIT_SECONDS * 1000));
    return battle;
  }

  async function refreshLobbyMessage(battle, chatId) {
    const participants = await mpModel.getParticipants(battle.id);
    const label = battle.type === mpModel.TYPES.TEAM ? 'نبرد تیمی' : 'نبرد آزاد چندنفره';
    const minP = battle.type === mpModel.TYPES.TEAM ? C.TEAM_MIN_PLAYERS : C.FFA_MIN_PLAYERS;
    const maxP = battle.type === mpModel.TYPES.TEAM ? C.TEAM_MAX_PLAYERS : C.FFA_MAX_PLAYERS;
    const names = participants.map((p) => escapeHtml(p.display_name)).join('، ');

    const text =
      `⚔️ <b>${label}</b>\n\n👥 بازیکنان (${participants.length}): ${names}\n` +
      `نیاز: حداقل ${minP}، حداکثر ${maxP} نفر\n\n` +
      `برای پیوستن دکمهٔ زیر را بزنید.`;

    await bot.telegram.editMessageText(chatId, battle.chat_message_id, undefined, text, {
      parse_mode: 'HTML', ...lobbyKeyboard(battle.id),
    }).catch(() => {});
  }

  async function joinBattle(battleId, telegramId, displayName, groupId, chatId) {
    const battle = await mpModel.getBattle(battleId);
    if (!battle || battle.state !== mpModel.STATES.RECRUITING) return { accepted: false, reason: 'NOT_RECRUITING' };

    const existing = await mpModel.isAlreadyJoined(battleId, telegramId);
    if (existing) return { accepted: false, reason: 'ALREADY_JOINED' };

    const participants = await mpModel.getParticipants(battleId);
    const maxP = battle.type === mpModel.TYPES.TEAM ? C.TEAM_MAX_PLAYERS : C.FFA_MAX_PLAYERS;
    if (participants.length >= maxP) return { accepted: false, reason: 'FULL' };

    const stats = (await playerStatsModel.getOrCreatePlayerStats(telegramId, groupId)).stats;
    await mpModel.addParticipant({
      battleId, telegramId, displayName, hp: stats.hp, maxHp: stats.max_hp, stamina: stats.stamina, maxStamina: stats.max_stamina,
    });

    const updated = await mpModel.getBattle(battleId);
    await refreshLobbyMessage(updated, chatId);

    if (participants.length + 1 >= maxP) {
      await beginBattle(updated, chatId);
    }
    return { accepted: true };
  }

  async function forceStart(battleId, requesterId, chatId) {
    const battle = await mpModel.getBattle(battleId);
    if (!battle || battle.state !== mpModel.STATES.RECRUITING) return { accepted: false, reason: 'NOT_RECRUITING' };
    if (requesterId !== battle.initiator_id) return { accepted: false, reason: 'NOT_INITIATOR' };

    const participants = await mpModel.getParticipants(battleId);
    const minP = battle.type === mpModel.TYPES.TEAM ? C.TEAM_MIN_PLAYERS : C.FFA_MIN_PLAYERS;
    if (participants.length < minP) return { accepted: false, reason: 'NOT_ENOUGH_PLAYERS', minP };

    clearTimer(recruitTimers, battleId);
    await beginBattle(battle, chatId);
    return { accepted: true };
  }

  async function resolveRecruitTimeout(battleId, chatId) {
    const battle = await mpModel.getBattle(battleId);
    if (!battle || battle.state !== mpModel.STATES.RECRUITING) return;
    const participants = await mpModel.getParticipants(battleId);
    const minP = battle.type === mpModel.TYPES.TEAM ? C.TEAM_MIN_PLAYERS : C.FFA_MIN_PLAYERS;

    if (participants.length >= minP) {
      await beginBattle(battle, chatId);
    } else {
      await mpModel.setState(battleId, mpModel.STATES.CANCELLED);
      await bot.telegram.editMessageText(chatId, battle.chat_message_id, undefined,
        `⌛ نفرات کافی برای شروع جمع نشد (حداقل ${minP} نفر لازم بود). این نبرد لغو شد.`
      ).catch(() => {});
    }
  }

  async function beginBattle(battle, chatId) {
    clearTimer(recruitTimers, battle.id);
    let participants = await mpModel.getParticipants(battle.id);

    if (battle.type === mpModel.TYPES.TEAM) {
      const updates = participants.map((p, i) => ({ id: p.id, patch: { team: i % 2 === 0 ? 'A' : 'B' } }));
      await mpModel.updateParticipants(updates);
      participants = await mpModel.getParticipants(battle.id);
      const teamA = participants.filter((p) => p.team === 'A').map((p) => p.display_name).join('، ');
      const teamB = participants.filter((p) => p.team === 'B').map((p) => p.display_name).join('، ');
      await sendAutoDelete(bot.telegram, chatId,
        `🔀 <b>قرعه‌کشی تیم‌ها</b>\n\n🔵 تیم A: ${escapeHtml(teamA)}\n🔴 تیم B: ${escapeHtml(teamB)}`,
        { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }
      ).catch(() => {});
    }

    const updatedBattle = await mpModel.advanceRound(battle.id, 1, mpModel.STATES.WAITING_FOR_MOVES);
    await sendRoundPrompt(updatedBattle, chatId);
  }

  // ============================== PVE ==============================

  async function startPveBattle(groupId, chatId, playerUser, difficulty, threadId = 0) {
    const battle = await mpModel.createBattle({
      groupId, type: mpModel.TYPES.PVE, maxRounds: C.PVE_MAX_ROUNDS, difficulty, initiatorId: playerUser.telegramId, threadId,
    });

    const stats = (await playerStatsModel.getOrCreatePlayerStats(playerUser.telegramId, groupId)).stats;
    await mpModel.addParticipant({
      battleId: battle.id, telegramId: playerUser.telegramId, displayName: playerUser.displayName,
      hp: stats.hp, maxHp: stats.max_hp, stamina: stats.stamina, maxStamina: stats.max_stamina,
    });
    // The bot mirrors the human's own combat power level (attack/defense/speed/crit) —
    // this MVP doesn't give Eris an independent RPG stat block. See guide.
    await mpModel.addParticipant({
      battleId: battle.id, isBot: true, displayName: 'اریس', hp: stats.max_hp, maxHp: stats.max_hp,
      stamina: stats.max_stamina, maxStamina: stats.max_stamina,
    });

    pveSupplies.set(battle.id, aiOpponent.initialAiSupplies(difficulty));

    const updatedBattle = await mpModel.advanceRound(battle.id, 1, mpModel.STATES.WAITING_FOR_MOVES);
    const sent = await sendAutoDelete(bot.telegram, chatId, `⚔️ <b>نبرد تمرینی با اریس شروع شد!</b> (سختی: ${difficultyLabel(difficulty)})`, { parse_mode: 'HTML', ...threadExtra(threadId) });
    await mpModel.setChatMessageId(battle.id, sent.message_id);
    await sendRoundPrompt(updatedBattle, chatId);
    return updatedBattle;
  }

  function difficultyLabel(d) {
    return { EASY: '🟢 آسان', MEDIUM: '🟡 متوسط', HARD: '🔴 سخت' }[d] || d;
  }

  // ============================== ROUND PROMPTS ==============================

  async function sendRoundPrompt(battle, chatId) {
    const participants = await mpModel.getParticipants(battle.id);
    const alive = participants.filter((p) => !p.is_eliminated);

    if (battle.type === mpModel.TYPES.PVE) {
      const human = alive.find((p) => !p.is_bot);
      const loadout = await cardLoadoutModel.getLoadout(human.telegram_id, battle.group_id);
      const text =
        `⚔️ <b>راند ${battle.round_number} — نبرد تمرینی</b>\n\n` +
        `👤 ${escapeHtml(human.display_name)}: ❤️ ${human.hp}  ⚡ ${human.stamina}\n` +
        `🗡 اریس: ❤️ ${alive.find((p) => p.is_bot).hp}  ⚡ ${alive.find((p) => p.is_bot).stamina}\n\n` +
        `حرکت خود را انتخاب کنید: (⏱ ${C.ROUND_TIMEOUT_SECONDS} ثانیه)`;
      const msg = await sendAutoDelete(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id), ...oneVsOneMoveKeyboard(battle.id, loadout) });
      await mpModel.setChatMessageId(battle.id, msg.message_id);
    } else if (battle.type === mpModel.TYPES.TEAM) {
      const teamA = alive.filter((p) => p.team === 'A');
      const teamB = alive.filter((p) => p.team === 'B');
      const championA = teamA[Math.floor(Math.random() * teamA.length)];
      const championB = teamB[Math.floor(Math.random() * teamB.length)];
      pendingMoves.set(battle.id, { __championA: championA.telegram_id, __championB: championB.telegram_id });

      const loadoutA = await cardLoadoutModel.getLoadout(championA.telegram_id, battle.group_id);
      const loadoutB = await cardLoadoutModel.getLoadout(championB.telegram_id, battle.group_id);
      const combined = Array.from(new Set([...loadoutA, ...loadoutB]));

      const text =
        `⚔️ <b>راند ${battle.round_number} — نبرد تیمی</b>\n\n` +
        `🔵 نمایندهٔ تیم A این راند: ${escapeHtml(championA.display_name)} (❤️ ${championA.hp} ⚡ ${championA.stamina})\n` +
        `🔴 نمایندهٔ تیم B این راند: ${escapeHtml(championB.display_name)} (❤️ ${championB.hp} ⚡ ${championB.stamina})\n\n` +
        `فقط این دو نفر این راند حرکت انتخاب می‌کنند. (⏱ ${C.ROUND_TIMEOUT_SECONDS} ثانیه)`;
      const msg = await sendAutoDelete(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id), ...oneVsOneMoveKeyboard(battle.id, combined) });
      await mpModel.setChatMessageId(battle.id, msg.message_id);
    } else {
      // FFA — every alive participant picks (move, target).
      const loadouts = await Promise.all(alive.map((p) => cardLoadoutModel.getLoadout(p.telegram_id, battle.group_id)));
      const combined = Array.from(new Set(loadouts.flat()));
      const statusLines = alive.map((p) => `👤 ${escapeHtml(p.display_name)}: ❤️ ${p.hp}  ⚡ ${p.stamina}`).join('\n');
      const text =
        `⚔️ <b>راند ${battle.round_number} — نبرد آزاد</b>\n\n${statusLines}\n\n` +
        `هرکس حرکت و هدف خودش را جدا انتخاب می‌کند. (⏱ ${C.ROUND_TIMEOUT_SECONDS} ثانیه)`;
      // One combined keyboard listing every alive player as a possible target;
      // Telegram can't show a different keyboard per person, so this shows
      // everyone (including yourself) — submitMove rejects self-targeting.
      const msg = await sendAutoDelete(bot.telegram, chatId, text, {
        parse_mode: 'HTML', ...threadExtra(battle.thread_id), ...ffaMoveKeyboard(battle.id, combined, alive),
      });
      await mpModel.setChatMessageId(battle.id, msg.message_id);
    }

    clearTimer(roundTimers, battle.id);
    roundTimers.set(battle.id, setTimeout(() => forceResolveRound(battle.id, chatId).catch(() => {}), C.ROUND_TIMEOUT_SECONDS * 1000));
  }

  // ============================== MOVE / ITEM SUBMISSION ==============================

  async function submitMove(battleId, telegramId, move, targetTelegramId, chatId) {
    const battle = await mpModel.getBattle(battleId);
    if (!battle || battle.state !== mpModel.STATES.WAITING_FOR_MOVES) return { accepted: false, reason: 'NOT_ACTIVE' };

    const participant = await mpModel.getParticipant(battleId, telegramId);
    if (!participant || participant.is_eliminated) return { accepted: false, reason: 'NOT_PARTICIPANT' };

    if (battle.type === mpModel.TYPES.TEAM) {
      const ctx = pendingMoves.get(battleId) || {};
      if (telegramId !== ctx.__championA && telegramId !== ctx.__championB) {
        return { accepted: false, reason: 'NOT_YOUR_TURN' };
      }
    }

    if (targetTelegramId === telegramId) return { accepted: false, reason: 'INVALID_TARGET' };

    const loadout = await cardLoadoutModel.getLoadout(telegramId, battle.group_id);
    if (!loadout.includes(move)) return { accepted: false, reason: 'NOT_EQUIPPED' };

    if (participant.locked_move && participant.locked_move === move) return { accepted: false, reason: 'MOVE_LOCKED' };

    const cost = specialCards.getMoveStaminaCost(move);
    if (cost === undefined) return { accepted: false, reason: 'INVALID_MOVE' };
    if (participant.stamina < cost) return { accepted: false, reason: 'NO_STAMINA' };

    const moves = pendingMoves.get(battleId) || {};
    if (moves[telegramId]) return { accepted: false, reason: 'ALREADY_MOVED' };
    moves[telegramId] = { move, target: targetTelegramId || null, submittedAt: Date.now() };
    pendingMoves.set(battleId, moves);

    const readyToResolve = await isRoundReady(battle, moves);
    if (readyToResolve) {
      clearTimer(roundTimers, battleId);
      await resolveRound(battle, chatId);
    }

    return { accepted: true, waiting: !readyToResolve };
  }

  async function isRoundReady(battle, moves) {
    if (battle.type === mpModel.TYPES.PVE) {
      const human = (await mpModel.getParticipants(battle.id)).find((p) => !p.is_bot);
      return !!moves[human.telegram_id];
    }
    if (battle.type === mpModel.TYPES.TEAM) {
      return !!moves[moves.__championA] && !!moves[moves.__championB];
    }
    // FFA: every still-alive participant must have moved.
    const alive = (await mpModel.getParticipants(battle.id)).filter((p) => !p.is_eliminated);
    return alive.every((p) => !!moves[p.telegram_id]);
  }

  async function useItem(battleId, telegramId, itemKey, chatId) {
    const battle = await mpModel.getBattle(battleId);
    if (!battle || battle.state !== mpModel.STATES.WAITING_FOR_MOVES) return { accepted: false, reason: 'NOT_ACTIVE' };

    const participant = await mpModel.getParticipant(battleId, telegramId);
    if (!participant || participant.is_eliminated) return { accepted: false, reason: 'NOT_PARTICIPANT' };

    const def = shopService.getItemDef(itemKey);
    if (!def || !['STAMINA_PILL', 'HEALING_POTION', 'ERIS_RICE'].includes(itemKey)) {
      return { accepted: false, reason: 'INVALID_ITEM' };
    }
    if (itemKey !== 'STAMINA_PILL' && isLateRound(battle)) {
      return { accepted: false, reason: 'HEAL_LOCKED_LATE_ROUND' };
    }

    const removed = await inventoryModel.removeItem(telegramId, battle.group_id, itemKey, 1);
    if (removed === null) return { accepted: false, reason: 'NO_ITEM' };

    const playerStats = await playerStatsModel.getPlayerStats(telegramId, battle.group_id);
    const patch = {};
    let effectLabel;

    if (itemKey === 'STAMINA_PILL' || itemKey === 'HEALING_POTION') {
      const effect = consumableService.computeEffect(itemKey);
      if (effect.stat === 'stamina') patch.stamina = Math.min(playerStats.max_stamina, participant.stamina + effect.amount);
      else patch.hp = Math.min(playerStats.max_hp, participant.hp + effect.amount);
      effectLabel = effect.label;
    } else {
      const pct = def.healPercentMin + Math.random() * (def.healPercentMax - def.healPercentMin);
      const amount = Math.round(playerStats.max_hp * pct);
      patch.hp = Math.min(playerStats.max_hp, participant.hp + amount);
      effectLabel = `❤️ +${amount} سلامتی`;
    }

    await mpModel.updateParticipants([{ id: participant.id, patch }]);

    const items = pendingItems.get(battleId) || {};
    const list = items[telegramId] || [];
    list.push(`${def.emoji || '📦'} ${def.label} (${effectLabel})`);
    items[telegramId] = list;
    pendingItems.set(battleId, items);

    return { accepted: true, effect: { label: effectLabel } };
  }

  // ============================== RESOLUTION ==============================

  async function forceResolveRound(battleId, chatId) {
    const battle = await mpModel.getBattle(battleId);
    if (!battle || battle.state !== mpModel.STATES.WAITING_FOR_MOVES) return;
    await resolveRound(battle, chatId);
  }

  async function resolveRound(battle, chatId) {
    const round = { moves: pendingMoves.get(battle.id) || {}, items: pendingItems.get(battle.id) || {} };
    clearRoundBookkeeping(battle.id);
    // Blocks late button presses / the timeout while this round is being resolved.
    await mpModel.setState(battle.id, mpModel.STATES.RESOLVING);
    if (battle.type === mpModel.TYPES.PVE) return resolvePveRound(battle, chatId, round);
    if (battle.type === mpModel.TYPES.TEAM) return resolveTeamRound(battle, chatId, round);
    return resolveFfaRound(battle, chatId, round);
  }

  async function resolvePveRound(battle, chatId, round) {
    const participants = await mpModel.getParticipants(battle.id);
    const human = participants.find((p) => !p.is_bot);
    const bot_ = participants.find((p) => p.is_bot);
    const moves = round.moves;
    const humanMove = moves[human.telegram_id]?.move || null;

    const supplies = pveSupplies.get(battle.id) || aiOpponent.initialAiSupplies(battle.difficulty);
    const supplyLine = aiOpponent.maybeUseSupplies(battle.difficulty, supplies, bot_);
    let botHp = bot_.hp;
    let botStamina = bot_.stamina;
    if (supplyLine) {
      if (supplyLine.stat === 'hp') botHp = Math.min(bot_.max_hp, botHp + supplyLine.amount);
      else botStamina = Math.min(bot_.max_stamina, botStamina + supplyLine.amount);
    }
    const playerLoadout = await cardLoadoutModel.getLoadout(human.telegram_id, battle.group_id);
    const botMove = aiOpponent.chooseAiMove(battle.difficulty, { ...bot_, stamina: botStamina }, playerLoadout);

    const humanStats = combatStatsOf(await playerStatsModel.getPlayerStats(human.telegram_id, battle.group_id));
    const botStats = humanStats; // mirror match — see guide

    const result = resolveOneVsOne(humanMove, humanStats, botMove, botStats);
    const log = [...result.log];
    if (supplyLine) log.push(supplyLine.label);

    const humanCost = humanMove ? (specialCards.getMoveStaminaCost(humanMove) ?? 0) : 0;
    const botCost = botMove ? (specialCards.getMoveStaminaCost(botMove) ?? 0) : 0;

    let newHumanHp = Math.max(0, human.hp - result.bDamageDealt - (result.effects?.selfDamageChallenger || 0));
    let newBotHp = Math.max(0, botHp - result.aDamageDealt - (result.effects?.selfDamageOpponent || 0));
    if (result.effects?.instantKillOpponent) newBotHp = 0;
    if (result.effects?.instantKillChallenger) newHumanHp = 0;

    const newHumanStamina = Math.max(0, human.stamina - humanCost);
    const newBotStamina = Math.max(0, botStamina - botCost);
    const newHumanAfk = humanMove ? 0 : human.afk_streak + 1;

    const itemsThisRound = round.items[human.telegram_id] || [];

    const text =
      `📋 <b>گزارش راند ${battle.round_number}</b>\n\n` +
      `👤 ${escapeHtml(human.display_name)}\n🎴 حرکت: ${humanMove ? getCardLabel(humanMove) : 'بدون واکنش'}\n💥 آسیب به اریس: ${num(result.aDamageDealt)}\n` +
      (itemsThisRound.length ? `🎒 ${itemsThisRound.join('، ')}\n` : '') + `\n` +
      `🗡 اریس\n🎴 حرکت: ${botMove ? getCardLabel(botMove) : 'بدون واکنش'}\n💥 آسیب به شما: ${num(result.bDamageDealt)}\n\n` +
      (log.length ? `📜 ${log.join('\n')}\n\n` : '') +
      `❤️ سلامتی: شما ${newHumanHp} | اریس ${newBotHp}\n⚡ استقامت: شما ${newHumanStamina} | اریس ${newBotStamina}`;
    // Persist — round report (exempt category).
    await sendPersist(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }).catch(() => {});

    await mpModel.updateParticipants([
      { id: human.id, patch: { hp: newHumanHp, stamina: newHumanStamina, afk_streak: newHumanAfk, locked_move: humanMove || null } },
      { id: bot_.id, patch: { hp: newBotHp, stamina: newBotStamina, locked_move: botMove || null } },
    ]);
    pveSupplies.set(battle.id, supplies);

    const over = newHumanHp <= 0 || newBotHp <= 0 || battle.round_number >= battle.max_rounds || newHumanAfk >= C.MAX_CONSECUTIVE_AFK_ROUNDS;
    if (over) {
      const humanWon = newBotHp <= 0 && newHumanHp > 0;
      await mpModel.setState(battle.id, mpModel.STATES.FINISHED);
      const xp = C.PVE_XP_REWARD + (humanWon ? Math.round(C.PVE_XP_REWARD * 0.5) : 0);
      const coins = C.PVE_COIN_REWARD + (humanWon ? Math.round(C.PVE_COIN_REWARD * 0.5) : 0);
      const stats = await playerStatsModel.getPlayerStats(human.telegram_id, battle.group_id);
      const xpResult = await xpService.grantXp(human.telegram_id, battle.group_id, stats, xp);
      await coinService.grantCoins(human.telegram_id, battle.group_id, xpResult.stats, coins, 'PVE_TRAINING');
      // Persist — final battle result (exempt category).
      await sendPersist(bot.telegram, chatId,
        `🏁 <b>نبرد تمرینی تمام شد</b>\n\n${humanWon ? '🎉 شما بردید!' : '💀 اریس این بار برنده شد.'}\n\n⭐ +${xp} XP\n🪙 +${coins} سکه`,
        { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }
      ).catch(() => {});
      pveSupplies.delete(battle.id);
      return;
    }

    const updated = await mpModel.advanceRound(battle.id, battle.round_number + 1, mpModel.STATES.WAITING_FOR_MOVES);
    await sendRoundPrompt(updated, chatId);
  }

  async function resolveTeamRound(battle, chatId, round) {
    const moves = round.moves;
    const championAId = moves.__championA;
    const championBId = moves.__championB;
    const participants = await mpModel.getParticipants(battle.id);
    const champA = participants.find((p) => p.telegram_id === championAId);
    const champB = participants.find((p) => p.telegram_id === championBId);
    const moveA = moves[championAId]?.move || null;
    const moveB = moves[championBId]?.move || null;

    const statsA = combatStatsOf(await playerStatsModel.getPlayerStats(championAId, battle.group_id));
    const statsB = combatStatsOf(await playerStatsModel.getPlayerStats(championBId, battle.group_id));
    const result = resolveOneVsOne(moveA, statsA, moveB, statsB);

    const costA = moveA ? (specialCards.getMoveStaminaCost(moveA) ?? 0) : 0;
    const costB = moveB ? (specialCards.getMoveStaminaCost(moveB) ?? 0) : 0;
    let newHpA = Math.max(0, champA.hp - result.bDamageDealt - (result.effects?.selfDamageChallenger || 0));
    let newHpB = Math.max(0, champB.hp - result.aDamageDealt - (result.effects?.selfDamageOpponent || 0));
    if (result.effects?.instantKillOpponent) newHpB = 0;
    if (result.effects?.instantKillChallenger) newHpA = 0;
    const newStaminaA = Math.max(0, champA.stamina - costA);
    const newStaminaB = Math.max(0, champB.stamina - costB);

    const patchList = [
      { id: champA.id, patch: { hp: newHpA, stamina: newStaminaA, locked_move: moveA || null, is_eliminated: newHpA <= 0 } },
      { id: champB.id, patch: { hp: newHpB, stamina: newStaminaB, locked_move: moveB || null, is_eliminated: newHpB <= 0 } },
    ];
    await mpModel.updateParticipants(patchList);

    const text =
      `📋 <b>گزارش راند ${battle.round_number}</b>\n\n` +
      `🔵 ${escapeHtml(champA.display_name)}: ${moveA ? getCardLabel(moveA) : 'بدون واکنش'} → ${num(result.aDamageDealt)} آسیب\n` +
      `🔴 ${escapeHtml(champB.display_name)}: ${moveB ? getCardLabel(moveB) : 'بدون واکنش'} → ${num(result.bDamageDealt)} آسیب\n\n` +
      (result.log.length ? `📜 ${result.log.join('\n')}\n\n` : '') +
      `❤️ ${escapeHtml(champA.display_name)}: ${newHpA} | ${escapeHtml(champB.display_name)}: ${newHpB}` +
      (newHpA <= 0 ? `\n💀 ${escapeHtml(champA.display_name)} حذف شد!` : '') +
      (newHpB <= 0 ? `\n💀 ${escapeHtml(champB.display_name)} حذف شد!` : '');
    // Persist — round report (exempt category).
    await sendPersist(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }).catch(() => {});

    const allParticipants = await mpModel.getParticipants(battle.id);
    const teamAAlive = allParticipants.filter((p) => p.team === 'A' && !p.is_eliminated);
    const teamBAlive = allParticipants.filter((p) => p.team === 'B' && !p.is_eliminated);

    const over = teamAAlive.length === 0 || teamBAlive.length === 0 || battle.round_number >= battle.max_rounds;
    if (over) {
      await mpModel.setState(battle.id, mpModel.STATES.FINISHED);
      const winningTeam = teamAAlive.length > 0 && teamBAlive.length === 0 ? 'A'
        : teamBAlive.length > 0 && teamAAlive.length === 0 ? 'B' : null;
      await finishMultiplayerBattle(allParticipants, winningTeam ? allParticipants.filter((p) => p.team === winningTeam) : null, battle, chatId, 'تیمی');
      return;
    }

    const updated = await mpModel.advanceRound(battle.id, battle.round_number + 1, mpModel.STATES.WAITING_FOR_MOVES);
    await sendRoundPrompt(updated, chatId);
  }

  async function resolveFfaRound(battle, chatId, round) {
    const moves = round.moves;
    const participants = await mpModel.getParticipants(battle.id);
    const alive = participants.filter((p) => !p.is_eliminated);
    const byId = Object.fromEntries(alive.map((p) => [p.telegram_id, p]));

    const damageTaken = Object.fromEntries(alive.map((p) => [p.telegram_id, 0]));
    const staminaSpent = Object.fromEntries(alive.map((p) => [p.telegram_id, 0]));
    const acted = Object.fromEntries(alive.map((p) => [p.telegram_id, false]));
    const logLines = [];

    const statsCache = {};
    async function getStats(telegramId) {
      if (!statsCache[telegramId]) statsCache[telegramId] = combatStatsOf(await playerStatsModel.getPlayerStats(telegramId, battle.group_id));
      return statsCache[telegramId];
    }

    for (const p of alive) {
      const entry = moves[p.telegram_id];
      if (!entry) continue;
      acted[p.telegram_id] = true;
      staminaSpent[p.telegram_id] += specialCards.getMoveStaminaCost(entry.move) ?? 0;

      if (entry.target && byId[entry.target]) {
        const attackerStats = await getStats(p.telegram_id);
        const defender = byId[entry.target];
        const defenderMove = moves[entry.target]?.move || null;
        const defenderStats = await getStats(entry.target);
        const result = specialCards.computeOneDirection(entry.move, attackerStats, defenderMove, defenderStats, false, escapeHtml(p.display_name));
        damageTaken[entry.target] += result.dmg;
        logLines.push(...result.log);
        if (result.tags.wasCountered) {
          const back = Math.round(engine.baseDamage(defenderStats.attack, attackerStats.defense, 1) * C.COUNTER_DAMAGE_MULTIPLIER);
          damageTaken[p.telegram_id] += back;
          logLines.push(`ضدحمله! ${escapeHtml(defender.display_name)} پاسخ داد.`);
        }
        if (result.tags.execute) damageTaken[entry.target] = 999999;
      } else if (!entry.target) {
        // Self/defensive moves (GUARD/DODGE/ICE_SHIELD/etc.) — no outgoing damage to compute here.
        if (entry.move === 'ICE_SHIELD') {
          const def = specialCards.getCardMoveDef('ICE_SHIELD');
          damageTaken[p.telegram_id] += def.selfDamage;
        }
      }
    }

    const patchList = [];
    for (const p of alive) {
      const newHp = Math.max(0, p.hp - damageTaken[p.telegram_id]);
      const newStamina = Math.max(0, p.stamina - staminaSpent[p.telegram_id]);
      const newAfk = acted[p.telegram_id] ? 0 : p.afk_streak + 1;
      const eliminated = newHp <= 0 || newAfk >= C.MAX_CONSECUTIVE_AFK_ROUNDS;
      patchList.push({
        id: p.id,
        patch: { hp: newHp, stamina: newStamina, afk_streak: newAfk, locked_move: moves[p.telegram_id]?.move || null, is_eliminated: eliminated },
      });
    }
    await mpModel.updateParticipants(patchList);

    const statusLines = alive.map((p) => {
      const newHp = Math.max(0, p.hp - damageTaken[p.telegram_id]);
      const eliminated = newHp <= 0;
      return `${eliminated ? '💀' : '👤'} ${escapeHtml(p.display_name)}: ${eliminated ? 'حذف شد' : `❤️ ${newHp}`}`;
    }).join('\n');

    const text = `📋 <b>گزارش راند ${battle.round_number}</b>\n\n${statusLines}` + (logLines.length ? `\n\n📜 ${logLines.join('\n')}` : '');
    // Persist — round report (exempt category).
    await sendPersist(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }).catch(() => {});

    const stillAlive = await mpModel.getParticipants(battle.id);
    const remaining = stillAlive.filter((p) => !p.is_eliminated);

    const over = remaining.length <= 1 || battle.round_number >= battle.max_rounds;
    if (over) {
      await mpModel.setState(battle.id, mpModel.STATES.FINISHED);
      await finishMultiplayerBattle(stillAlive, remaining.length === 1 ? remaining : null, battle, chatId, 'آزاد');
      return;
    }

    const updated = await mpModel.advanceRound(battle.id, battle.round_number + 1, mpModel.STATES.WAITING_FOR_MOVES);
    await sendRoundPrompt(updated, chatId);
  }

  async function finishMultiplayerBattle(allParticipants, winners, battle, chatId, labelFa) {
    const winnerIds = new Set((winners || []).map((w) => w.telegram_id));
    let text = `🏆 <b>نبرد ${labelFa} تمام شد</b>\n\n`;
    text += winners
      ? `🎉 برنده: ${winners.map((w) => escapeHtml(w.display_name)).join('، ')}\n\n`
      : `⚔️ نبرد بدون برندهٔ مشخص به پایان رسید (سقف راند).\n\n`;

    for (const p of allParticipants) {
      const stats = await playerStatsModel.getPlayerStats(p.telegram_id, battle.group_id);
      if (!stats) continue;
      const won = winnerIds.has(p.telegram_id);
      const xp = won ? C.XP_PVP_WIN : C.XP_PVP_LOSS;
      const coins = won ? C.COINS_PVP_WIN : C.COINS_PVP_LOSS;
      const xpResult = await xpService.grantXp(p.telegram_id, battle.group_id, stats, xp);
      await coinService.grantCoins(p.telegram_id, battle.group_id, xpResult.stats, coins, won ? 'MULTIPLAYER_WIN' : 'MULTIPLAYER_LOSS');
      text += `${won ? '🎉' : '💀'} ${escapeHtml(p.display_name)}: +${xp} XP، +${coins} سکه\n`;
    }

    // Persist — final battle result (exempt category).
    await sendPersist(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }).catch(() => {});
    clearRoundBookkeeping(battle.id);
  }

  async function sweepExpiredRecruiting() {
    const expired = await mpModel.expireStaleRecruiting();
    for (const battle of expired) {
      clearTimer(recruitTimers, battle.id);
      if (battle.chat_message_id) {
        await bot.telegram.editMessageText(battle.group_id, battle.chat_message_id, undefined,
          '⌛ نفرات کافی برای این نبرد جمع نشد.'
        ).catch(() => {});
      }
    }
  }

  return {
    startRecruiting, joinBattle, forceStart, startPveBattle, submitMove, useItem, sweepExpiredRecruiting,
  };
}

module.exports = { createMultiplayerBattleManager };
