'use strict';
const C = require('../config/constants');
const battleModel = require('../database/models/battleModel');
const playerStatsModel = require('../database/models/playerStatsModel');
const userModel = require('../database/models/userModel');
const transactionModel = require('../database/models/transactionModel');
const groupModel = require('../database/models/groupModel');
const inventoryModel = require('../database/models/inventoryModel');
const cardLoadoutModel = require('../database/models/cardLoadoutModel');

const engine = require('./battleEngine');
const specialCards = require('./specialCards');
const xpService = require('../ranking/xpService');
const ratingService = require('../ranking/ratingService');
const streakService = require('../ranking/streakService');
const coinService = require('../economy/coinService');
const shopService = require('../economy/shopService');
const consumableService = require('../economy/consumableService');
const rageService = require('../eris/rageService');
const erisVoice = require('../eris/erisVoice');
const achievementModel = require('../database/models/achievementModel');
const dailyChallengeService = require('../services/dailyChallengeService');
const erisEventService = require('../events/erisEventService');
const { getDuplicateOpponentRewardScale } = require('../utils/antiAbuse');
const { getCardLabel } = require('../utils/cardLabels');
const { num, escapeHtml } = require('../utils/format');
const { moveKeyboard, challengeKeyboard } = require('../bot/keyboards');
// Phase 6: group-chat message cleanup. sendAutoDelete = default for most
// messages this module sends (challenge invites, move-selection prompts).
// sendPersist = the 2 exceptions this module is responsible for: the
// per-round report (sendRoundReport) and the final duel result
// (finalizeBattle) — see src/utils/messageCleanup.js for the full rationale.
const { sendAutoDelete, sendPersist } = require('../utils/messageCleanup');
const { threadExtra } = require('../utils/topic');

// In-memory timers, keyed by battle id. A single bot process owns these;
// all authoritative state still lives in Postgres (spec §28, §32).
const roundTimers = new Map();
const challengeTimers = new Map();
// Pending moves collected for the current round before both sides are in.
// { [telegramId]: { move: string|null, submittedAt: number } }
const pendingMoves = new Map();
// Items consumed so far THIS round, kept only for the round report text —
// the actual stat effect is already applied live (see useItem).
const pendingItems = new Map(); // battleId -> { [telegramId]: string[] }

function clearTimer(map, battleId) {
  const t = map.get(battleId);
  if (t) {
    clearTimeout(t);
    map.delete(battleId);
  }
}

function clearRoundBookkeeping(battleId) {
  pendingMoves.delete(battleId);
  pendingItems.delete(battleId);
}

function rankLabel(swordRankKey) {
  const { getRankByKey } = require('../utils/rankUtil');
  const r = getRankByKey(swordRankKey);
  return r ? r.label : swordRankKey;
}

function createBattleManager(bot) {
  async function getCombinedCardKeys(battle) {
    const [cLoadout, oLoadout] = await Promise.all([
      cardLoadoutModel.getLoadout(battle.challenger_id, battle.group_id),
      cardLoadoutModel.getLoadout(battle.opponent_id, battle.group_id),
    ]);
    return Array.from(new Set([...cLoadout, ...oLoadout]));
  }

  async function startChallenge({ groupId, challengerUser, opponentUser, chatId, threadId = 0 }) {
    const challengerStats = (await playerStatsModel.getOrCreatePlayerStats(challengerUser.telegramId, groupId)).stats;
    const opponentStats = (await playerStatsModel.getOrCreatePlayerStats(opponentUser.telegramId, groupId)).stats;

    const battle = await battleModel.createBattle({
      groupId,
      challengerId: challengerUser.telegramId,
      opponentId: opponentUser.telegramId,
      challengerStats,
      opponentStats,
      threadId,
    });

    const text =
    `⚔️ <b>چالش دوئل</b>\n\n` +
    `${escapeHtml(challengerUser.displayName)}، ${escapeHtml(opponentUser.displayName)} را به مبارزه دعوت کرد!\n\n` +
    `${escapeHtml(challengerUser.displayName)}:\n⚔️ ${rankLabel(challengerStats.sword_rank)}\n❤️ ${challengerStats.hp} سلامتی\n⚡ ${challengerStats.stamina} استقامت\n\n` +
    `${escapeHtml(opponentUser.displayName)}:\n⚔️ ${rankLabel(opponentStats.sword_rank)}\n❤️ ${opponentStats.hp} سلامتی\n⚡ ${opponentStats.stamina} استقامت`;

    const sent = await sendAutoDelete(bot.telegram, chatId, text, {
      parse_mode: 'HTML',
      ...threadExtra(threadId),
      ...challengeKeyboard(battle.id),
    });
    await battleModel.setChatMessageId(battle.id, sent.message_id);

    challengeTimers.set(
      battle.id,
      setTimeout(() => expireChallenge(battle.id, chatId).catch(() => {}), C.CHALLENGE_TIMEOUT_SECONDS * 1000)
    );

    return battle;
  }

  async function expireChallenge(battleId, chatId) {
    const battle = await battleModel.transitionState(
      battleId, [battleModel.STATES.WAITING_FOR_ACCEPT], battleModel.STATES.EXPIRED
    );
    if (battle) {
      await bot.telegram.editMessageText(chatId, battle.chat_message_id, undefined,
       '⌛ زمان چالش به پایان رسید. کسی به‌موقع قبول نکرد.');
    }
    clearTimer(challengeTimers, battleId);
  }

  async function acceptChallenge(battleId, chatId) {
    clearTimer(challengeTimers, battleId);
    const battle = await battleModel.transitionState(
      battleId,
      [battleModel.STATES.WAITING_FOR_ACCEPT],
      battleModel.STATES.WAITING_FOR_MOVES,
      { round_number: 1 },
      [1]
    );
    if (!battle) return null;
    await sendRoundMessage(battle, chatId);
    return battle;
  }

  async function declineChallenge(battleId, chatId) {
    clearTimer(challengeTimers, battleId);
    const battle = await battleModel.transitionState(
      battleId, [battleModel.STATES.WAITING_FOR_ACCEPT], battleModel.STATES.CANCELLED
    );
    if (battle) {
      await bot.telegram.editMessageText(
        chatId, battle.chat_message_id, undefined,
       `❌ چالش رد شد.\n\nEris: "${erisVoice.say('challenge_declined')}"`
      );
    }
    return battle;
  }

  async function sendRoundMessage(battle, chatId) {
    const challenger = await userModel.getUser(battle.challenger_id);
    const opponent = await userModel.getUser(battle.opponent_id);
    const cardKeys = await getCombinedCardKeys(battle);

    let lockNotice = '';
    if (battle.challenger_locked_move) {
      lockNotice += `🔒 ${escapeHtml(challenger.display_name)} این راند نمی‌تواند «${getCardLabel(battle.challenger_locked_move)}» را انتخاب کند.\n`;
    }
    if (battle.opponent_locked_move) {
      lockNotice += `🔒 ${escapeHtml(opponent.display_name)} این راند نمی‌تواند «${getCardLabel(battle.opponent_locked_move)}» را انتخاب کند.\n`;
    }
    if (battle.round_number >= C.HEAL_LOCK_START_ROUND) {
      lockNotice += `⛔ از این راند به بعد مصرف آیتم‌های درمانی (معجون/برنج) مجاز نیست.\n`;
    }

    const text =
    `⚔️ <b>دوئل — راند ${battle.round_number}</b>\n\n` +
    `👤 ${escapeHtml(challenger.display_name)}\n❤️ ${battle.challenger_hp}  ⚡ ${battle.challenger_stamina}\n\n` +
    `👤 ${escapeHtml(opponent.display_name)}\n❤️ ${battle.opponent_hp}  ⚡ ${battle.opponent_stamina}\n\n` +
    (lockNotice ? `${lockNotice}\n` : '') +
    `حرکت خود را انتخاب کنید: (⏱ ${C.ROUND_TIMEOUT_SECONDS} ثانیه)\n` +
    `<i>می‌توانید علاوه بر حرکت، یک آیتم هم مصرف کنید.</i>`;

    const message = await bot.telegram.editMessageText(
      chatId, battle.chat_message_id, undefined, text,
      { parse_mode: 'HTML', ...moveKeyboard(battle.id, cardKeys) }
    ).catch(() =>
      sendAutoDelete(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id), ...moveKeyboard(battle.id, cardKeys) })
    );

    clearTimer(roundTimers, battle.id);
    roundTimers.set(
      battle.id,
      setTimeout(() => forceResolveRound(battle.id, chatId).catch(() => {}), C.ROUND_TIMEOUT_SECONDS * 1000)
    );

    return message;
  }

  async function submitMove(battleId, telegramId, move, chatId) {
    const battle = await battleModel.getBattle(battleId);
    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_MOVES) {
      return { accepted: false, reason: 'NOT_ACTIVE' };
    }
    if (telegramId !== battle.challenger_id && telegramId !== battle.opponent_id) {
      return { accepted: false, reason: 'NOT_PARTICIPANT' };
    }

    const isChallenger = telegramId === battle.challenger_id;

    // Must actually be equipped in this player's own جیب من loadout (Phase 2).
    const loadout = await cardLoadoutModel.getLoadout(telegramId, battle.group_id);
    if (!loadout.includes(move)) {
      return { accepted: false, reason: 'NOT_EQUIPPED' };
    }

    // Move-repeat lock (spec §9): can't use the same style two rounds running.
    const lockedMove = isChallenger ? battle.challenger_locked_move : battle.opponent_locked_move;
    if (lockedMove && lockedMove === move) {
      return { accepted: false, reason: 'MOVE_LOCKED' };
    }

    // Stun (رعد و برق / پری موفق against you last round).
    const activeEffects = Array.isArray(battle.active_effects) ? battle.active_effects : [];
    const side = isChallenger ? 'CHALLENGER' : 'OPPONENT';
    if (activeEffects.some((e) => e.type === 'STUN' && e.side === side)) {
      return { accepted: false, reason: 'STUNNED' };
    }

    const stamina = isChallenger ? battle.challenger_stamina : battle.opponent_stamina;
    const cost = specialCards.getMoveStaminaCost(move);
    if (cost === undefined) return { accepted: false, reason: 'INVALID_MOVE' };
    if (stamina < cost) return { accepted: false, reason: 'NO_STAMINA' };

    const moves = pendingMoves.get(battleId) || {};
    if (moves[telegramId]) return { accepted: false, reason: 'ALREADY_MOVED' };
    moves[telegramId] = { move, submittedAt: Date.now() };
    pendingMoves.set(battleId, moves);

    const bothIn = moves[battle.challenger_id] && moves[battle.opponent_id];
    if (bothIn) {
      clearTimer(roundTimers, battleId);
      await resolveRound(battle, moves, chatId);
      clearRoundBookkeeping(battleId);
    }

    return { accepted: true, waitingForOpponent: !bothIn };
  }

  /**
   * Uses one item mid-round — a free action alongside (not instead of) the
   * player's move. Handles all 6 in-battle items (Phase 1-4).
   */
  async function useItem(battleId, telegramId, itemKey, chatId) {
    const battle = await battleModel.getBattle(battleId);
    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_MOVES) {
      return { accepted: false, reason: 'NOT_ACTIVE' };
    }
    if (telegramId !== battle.challenger_id && telegramId !== battle.opponent_id) {
      return { accepted: false, reason: 'NOT_PARTICIPANT' };
    }

    const def = shopService.getItemDef(itemKey);
    if (!def || !def.usableInBattle) return { accepted: false, reason: 'INVALID_ITEM' };

    const isHealItem = itemKey === 'HEALING_POTION' || itemKey === 'ERIS_RICE';
    if (isHealItem && battle.round_number >= C.HEAL_LOCK_START_ROUND) {
      return { accepted: false, reason: 'HEAL_LOCKED_LATE_ROUND' };
    }

    const removed = await inventoryModel.removeItem(telegramId, battle.group_id, itemKey, 1);
    if (removed === null) return { accepted: false, reason: 'NO_ITEM' };

    const isChallenger = telegramId === battle.challenger_id;
    const playerStats = await playerStatsModel.getPlayerStats(telegramId, battle.group_id);
    const patch = {};
    let effectLabel;
    let activeEffects = Array.isArray(battle.active_effects) ? [...battle.active_effects] : [];
    const effectsChanged = () => { patch.active_effects = activeEffects; };

    if (itemKey === 'STAMINA_PILL' || itemKey === 'HEALING_POTION') {
      const effect = consumableService.computeEffect(itemKey);
      if (effect.stat === 'stamina') {
        const current = isChallenger ? battle.challenger_stamina : battle.opponent_stamina;
        patch[isChallenger ? 'challenger_stamina' : 'opponent_stamina'] = Math.min(playerStats.max_stamina, current + effect.amount);
      } else {
        const current = isChallenger ? battle.challenger_hp : battle.opponent_hp;
        patch[isChallenger ? 'challenger_hp' : 'opponent_hp'] = Math.min(playerStats.max_hp, current + effect.amount);
      }
      effectLabel = effect.label;
    } else if (itemKey === 'ERIS_RICE') {
      const pct = def.healPercentMin + Math.random() * (def.healPercentMax - def.healPercentMin);
      const amount = Math.round(playerStats.max_hp * pct);
      const current = isChallenger ? battle.challenger_hp : battle.opponent_hp;
      patch[isChallenger ? 'challenger_hp' : 'opponent_hp'] = Math.min(playerStats.max_hp, current + amount);
      effectLabel = `❤️ +${amount} سلامتی (${Math.round(pct * 100)}٪)`;
    } else if (itemKey === 'CAT_DOLL') {
      activeEffects.push({
        side: isChallenger ? 'CHALLENGER' : 'OPPONENT', type: 'STAMINA_REGEN_BUFF',
        roundsRemaining: def.durationRounds, amountPerRound: def.staminaPerRound,
      });
      effectsChanged();
      effectLabel = `برای ${def.durationRounds} راند، هر راند ${def.staminaPerRound}+ استقامت`;
    } else if (itemKey === 'POISON_SWAMP') {
      activeEffects.push({
        side: isChallenger ? 'OPPONENT' : 'CHALLENGER', type: 'POISON',
        roundsRemaining: def.durationRounds, amountPerRound: def.opponentDamagePerRound,
      });
      activeEffects.push({
        side: isChallenger ? 'CHALLENGER' : 'OPPONENT', type: 'POISON',
        roundsRemaining: def.durationRounds, amountPerRound: def.selfDamagePerRound,
      });
      effectsChanged();
      effectLabel = `فعال شد برای ${def.durationRounds} راند`;
    } else if (itemKey === 'TRUTH_SCROLL') {
      patch.hidden_report_side = isChallenger ? 'CHALLENGER' : 'OPPONENT';
      effectLabel = `سلامتی شما در گزارش بعدی از حریف پنهان می‌شود`;
    } else {
      return { accepted: false, reason: 'INVALID_ITEM' };
    }

    await battleModel.updateLiveStats(battleId, patch);

    const items = pendingItems.get(battleId) || {};
    const list = items[telegramId] || [];
    list.push(`${def.emoji || '📦'} ${def.label} (${effectLabel})`);
    items[telegramId] = list;
    pendingItems.set(battleId, items);

    return { accepted: true, effect: { label: effectLabel }, itemDef: def };
  }

  async function forceResolveRound(battleId, chatId) {
    const battle = await battleModel.getBattle(battleId);
    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_MOVES) return;

    const moves = pendingMoves.get(battleId) || {};
    if (!moves[battle.challenger_id]) {
      moves[battle.challenger_id] = { move: engine.autoDefensiveMove(battle.challenger_stamina), submittedAt: Date.now() };
    }
    if (!moves[battle.opponent_id]) {
      moves[battle.opponent_id] = { move: engine.autoDefensiveMove(battle.opponent_stamina), submittedAt: Date.now() };
    }
    await resolveRound(battle, moves, chatId, true);
    clearRoundBookkeeping(battleId);
  }

  async function sendRoundReport(battle, chatId, ctx) {
    const {
      challenger, opponent, cMove, oMove, aDamageDealt, bDamageDealt, log,
      newChallengerHp, newOpponentHp, newChallengerStamina, newOpponentStamina,
      specialEffects, hiddenReportSide,
    } = ctx;

    const itemsThisRound = pendingItems.get(battle.id) || {};
    const cItems = itemsThisRound[battle.challenger_id] || [];
    const oItems = itemsThisRound[battle.opponent_id] || [];

    const displayADamage = specialEffects?.fakeChallengerDisplayDamage ?? aDamageDealt;
    const displayBDamage = specialEffects?.fakeOpponentDisplayDamage ?? bDamageDealt;

    let text = `📋 <b>گزارش راند ${battle.round_number}</b>\n\n`;

    text +=
      `👤 ${escapeHtml(challenger.display_name)}\n` +
      `🎴 حرکت: ${cMove ? getCardLabel(cMove) : 'بدون واکنش (بی‌رمق)'}\n` +
      `💥 آسیب واردشده به حریف: ${num(displayADamage)}\n` +
      (cItems.length ? `🎒 آیتم مصرف‌شده: ${cItems.join('، ')}\n` : '') +
      `\n`;

    text +=
      `👤 ${escapeHtml(opponent.display_name)}\n` +
      `🎴 حرکت: ${oMove ? getCardLabel(oMove) : 'بدون واکنش (بی‌رمق)'}\n` +
      `💥 آسیب واردشده به حریف: ${num(displayBDamage)}\n` +
      (oItems.length ? `🎒 آیتم مصرف‌شده: ${oItems.join('، ')}\n` : '') +
      `\n`;

    if (log.length) {
      text += `📜 ${log.join('\n')}\n\n`;
    }

    const challengerHpText = hiddenReportSide === 'CHALLENGER' ? '❓' : String(newChallengerHp);
    const opponentHpText = hiddenReportSide === 'OPPONENT' ? '❓' : String(newOpponentHp);

    text +=
      `❤️ سلامتی باقی‌مانده:\n${escapeHtml(challenger.display_name)}: ${challengerHpText} | ${escapeHtml(opponent.display_name)}: ${opponentHpText}\n\n` +
      `⚡ استقامت باقی‌مانده:\n${escapeHtml(challenger.display_name)}: ${newChallengerStamina} | ${escapeHtml(opponent.display_name)}: ${newOpponentStamina}`;

    // Persist — this IS "گزارش هر راند مبارزه", one of the 3 exempt categories.
    await sendPersist(bot.telegram, chatId, text, { parse_mode: 'HTML', ...threadExtra(battle.thread_id) }).catch(() => {});
  }

  async function resolveRound(battle, moves) {
    const chatId = battle.group_id;
    const cEntry = moves[battle.challenger_id] || {};
    const oEntry = moves[battle.opponent_id] || {};
    const cMove = cEntry.move ?? null;
    const oMove = oEntry.move ?? null;
    const cAfk = !cMove;
    const oAfk = !oMove;

    const challenger = await userModel.getUser(battle.challenger_id);
    const opponent = await userModel.getUser(battle.opponent_id);

    // ---- Start-of-round: process poison / stamina-regen-buff / consume stun & guard-break ----
    const rawEffects = Array.isArray(battle.active_effects) ? battle.active_effects : [];
    let hpAdjustC = 0;
    let hpAdjustO = 0;
    let staminaAdjustC = 0;
    let staminaAdjustO = 0;
    let challengerWasStunned = false;
    let opponentWasStunned = false;
    let challengerGuardBrokenThisRound = false;
    let opponentGuardBrokenThisRound = false;
    const nextActiveEffects = [];
    const effectLogLines = [];

    for (const eff of rawEffects) {
      if (eff.type === 'POISON') {
        if (eff.side === 'CHALLENGER') {
          hpAdjustC -= eff.amountPerRound;
          effectLogLines.push(`☠️ باتلاق سمی ${eff.amountPerRound} آسیب به ${escapeHtml(challenger.display_name)} زد.`);
        } else {
          hpAdjustO -= eff.amountPerRound;
          effectLogLines.push(`☠️ باتلاق سمی ${eff.amountPerRound} آسیب به ${escapeHtml(opponent.display_name)} زد.`);
        }
        const remaining = eff.roundsRemaining - 1;
        if (remaining > 0) nextActiveEffects.push({ ...eff, roundsRemaining: remaining });
      } else if (eff.type === 'STAMINA_REGEN_BUFF') {
        if (eff.side === 'CHALLENGER') staminaAdjustC += eff.amountPerRound;
        else staminaAdjustO += eff.amountPerRound;
        const remaining = eff.roundsRemaining - 1;
        if (remaining > 0) nextActiveEffects.push({ ...eff, roundsRemaining: remaining });
      } else if (eff.type === 'STUN') {
        if (eff.side === 'CHALLENGER') challengerWasStunned = true;
        else opponentWasStunned = true;
        // fully consumed this round, never carried forward
      } else if (eff.type === 'GUARD_BREAK') {
        if (eff.side === 'CHALLENGER') challengerGuardBrokenThisRound = true;
        else opponentGuardBrokenThisRound = true;
        // fully consumed this round
      }
    }

    const cPlayer = await playerStatsModel.getPlayerStats(battle.challenger_id, battle.group_id);
    const oPlayer = await playerStatsModel.getPlayerStats(battle.opponent_id, battle.group_id);

    const preHpC = Math.max(0, Math.min(cPlayer.max_hp, battle.challenger_hp + hpAdjustC));
    const preHpO = Math.max(0, Math.min(oPlayer.max_hp, battle.opponent_hp + hpAdjustO));
    const preStaminaC = Math.max(0, Math.min(cPlayer.max_stamina, battle.challenger_stamina + staminaAdjustC));
    const preStaminaO = Math.max(0, Math.min(oPlayer.max_stamina, battle.opponent_stamina + staminaAdjustO));

    const cStats = {
      attack: cPlayer.attack, defense: cPlayer.defense, speed: cPlayer.speed,
      critChance: Number(cPlayer.crit_chance), stamina: preStaminaC, hp: preHpC, maxHp: cPlayer.max_hp,
    };
    const oStats = {
      attack: oPlayer.attack, defense: oPlayer.defense, speed: oPlayer.speed,
      critChance: Number(oPlayer.crit_chance), stamina: preStaminaO, hp: preHpO, maxHp: oPlayer.max_hp,
    };

    let aDamageDealt = 0;
    let bDamageDealt = 0;
    let log = [...effectLogLines];
    let specialEffects = null;
    const useSpecial = specialCards.isSpecialMove(cMove) || specialCards.isSpecialMove(oMove);
    const guardBrokenCtx = { challengerGuardBroken: challengerGuardBrokenThisRound, opponentGuardBroken: opponentGuardBrokenThisRound };

    if (!cAfk && !oAfk) {
      if (useSpecial) {
        const result = specialCards.resolveMixedRound(cMove, cStats, oMove, oStats, guardBrokenCtx);
        aDamageDealt = result.aDamageDealt; bDamageDealt = result.bDamageDealt;
        log.push(...result.log); specialEffects = result.effects;
      } else {
        const result = engine.resolveRound(cMove, cStats, oMove, oStats);
        aDamageDealt = result.aDamageDealt; bDamageDealt = result.bDamageDealt;
        log.push(...result.log);
      }
    } else if (!cAfk && oAfk) {
      if (specialCards.isSpecialMove(cMove)) {
        const result = specialCards.resolveMixedRound(cMove, cStats, engine.MOVES.GUARD, oStats, guardBrokenCtx);
        aDamageDealt = result.aDamageDealt; log.push(...result.log); specialEffects = result.effects;
      } else {
        const result = engine.resolveRound(cMove, cStats, engine.MOVES.GUARD, oStats);
        aDamageDealt = result.aDamageDealt; log.push(...result.log);
      }
      log.push(opponentWasStunned ? 'حریف توسط یک اثر ویژه بی‌حس شده بود و نتوانست واکنش نشان دهد!' : 'حریف آن‌قدر خسته بود که نتوانست واکنش نشان دهد!');
    } else if (cAfk && !oAfk) {
      if (specialCards.isSpecialMove(oMove)) {
        const result = specialCards.resolveMixedRound(engine.MOVES.GUARD, cStats, oMove, oStats, guardBrokenCtx);
        bDamageDealt = result.bDamageDealt; log.push(...result.log); specialEffects = result.effects;
      } else {
        const result = engine.resolveRound(engine.MOVES.GUARD, cStats, oMove, oStats);
        bDamageDealt = result.bDamageDealt; log.push(...result.log);
      }
      log.push(challengerWasStunned ? 'چالشگر توسط یک اثر ویژه بی‌حس شده بود و نتوانست واکنش نشان دهد!' : 'چالشگر آن‌قدر خسته بود که نتوانست واکنش نشان دهد!');
    } else {
      log.push('هر دو مبارز تلوتلو خوردند — این راند ضربهٔ مؤثری وارد نشد.');
    }

    // Sylphy Heal — immediate + per-second-waiting (needs real submission timestamps).
    let sylphyHealC = 0;
    let sylphyHealO = 0;
    if (cMove === 'SYLPHY_HEAL') {
      const def = shopService.getItemDef('SYLPHY_HEAL');
      const waitSeconds = oEntry.submittedAt
        ? Math.max(0, Math.min(C.ROUND_TIMEOUT_SECONDS, (oEntry.submittedAt - cEntry.submittedAt) / 1000)) : 0;
      sylphyHealC = def.immediateHeal + Math.floor(waitSeconds * def.healPerSecondWaiting);
      log.push(`💚 درمانگری ${sylphyHealC} سلامتی برای ${escapeHtml(challenger.display_name)} بازیابی کرد.`);
    }
    if (oMove === 'SYLPHY_HEAL') {
      const def = shopService.getItemDef('SYLPHY_HEAL');
      const waitSeconds = cEntry.submittedAt
        ? Math.max(0, Math.min(C.ROUND_TIMEOUT_SECONDS, (cEntry.submittedAt - oEntry.submittedAt) / 1000)) : 0;
      sylphyHealO = def.immediateHeal + Math.floor(waitSeconds * def.healPerSecondWaiting);
      log.push(`💚 درمانگری ${sylphyHealO} سلامتی برای ${escapeHtml(opponent.display_name)} بازیابی کرد.`);
    }

    const cCostMove = cMove || engine.MOVES.GUARD;
    const oCostMove = oMove || engine.MOVES.GUARD;
    const cCost = cAfk ? 0 : (specialCards.getMoveStaminaCost(cCostMove) ?? 0);
    const oCost = oAfk ? 0 : (specialCards.getMoveStaminaCost(oCostMove) ?? 0);
    const extraCostC = specialEffects?.extraStaminaCostChallenger || 0;
    const extraCostO = specialEffects?.extraStaminaCostOpponent || 0;

    const selfDamageC = specialEffects?.selfDamageChallenger || 0;
    const selfDamageO = specialEffects?.selfDamageOpponent || 0;

    let newChallengerHp = Math.max(0, Math.min(cPlayer.max_hp, preHpC - bDamageDealt - selfDamageC + sylphyHealC));
    let newOpponentHp = Math.max(0, Math.min(oPlayer.max_hp, preHpO - aDamageDealt - selfDamageO + sylphyHealO));
    if (specialEffects?.instantKillOpponent) newOpponentHp = 0;
    if (specialEffects?.instantKillChallenger) newChallengerHp = 0;

    const newChallengerStamina = Math.max(0, preStaminaC - cCost - extraCostC);
    const newOpponentStamina = Math.max(0, preStaminaO - oCost - extraCostO);

    let newChallengerAfkStreak;
    if (!cAfk) newChallengerAfkStreak = 0;
    else if (challengerWasStunned) newChallengerAfkStreak = battle.challenger_afk_streak;
    else newChallengerAfkStreak = battle.challenger_afk_streak + 1;

    let newOpponentAfkStreak;
    if (!oAfk) newOpponentAfkStreak = 0;
    else if (opponentWasStunned) newOpponentAfkStreak = battle.opponent_afk_streak;
    else newOpponentAfkStreak = battle.opponent_afk_streak + 1;

    // Move-repeat lock for next round (spec §9) — clears if no real move was made.
    const nextChallengerLockedMove = cAfk ? null : cMove;
    const nextOpponentLockedMove = oAfk ? null : oMove;

    if (specialEffects?.stunChallenger) nextActiveEffects.push({ side: 'CHALLENGER', type: 'STUN', roundsRemaining: 1 });
    if (specialEffects?.stunOpponent) nextActiveEffects.push({ side: 'OPPONENT', type: 'STUN', roundsRemaining: 1 });
    if (specialEffects?.guardBreakChallenger) nextActiveEffects.push({ side: 'CHALLENGER', type: 'GUARD_BREAK', roundsRemaining: 1 });
    if (specialEffects?.guardBreakOpponent) nextActiveEffects.push({ side: 'OPPONENT', type: 'GUARD_BREAK', roundsRemaining: 1 });

    const itemsThisRound = pendingItems.get(battle.id) || {};
    const persistedLog = [...log];
    for (const telegramId of Object.keys(itemsThisRound)) {
      for (const line of itemsThisRound[telegramId]) persistedLog.push(line);
    }

    await battleModel.recordRound(battle.id, battle.round_number, {
      challengerMove: cMove, opponentMove: oMove,
      challengerDamageDealt: aDamageDealt, opponentDamageDealt: bDamageDealt, log: persistedLog,
    });

    const hiddenReportSide = battle.hidden_report_side || null;

    await sendRoundReport(battle, chatId, {
      challenger, opponent, cMove, oMove, aDamageDealt, bDamageDealt, log,
      newChallengerHp, newOpponentHp, newChallengerStamina, newOpponentStamina,
      specialEffects, hiddenReportSide,
    });

    if (hiddenReportSide) {
      await battleModel.updateLiveStats(battle.id, { hidden_report_side: null });
    }

    const battleOver =
      newChallengerHp <= 0 || newOpponentHp <= 0 ||
      battle.round_number >= C.MAX_ROUNDS ||
      newChallengerAfkStreak >= C.MAX_CONSECUTIVE_AFK_ROUNDS ||
      newOpponentAfkStreak >= C.MAX_CONSECUTIVE_AFK_ROUNDS;

    if (battleOver) {
      let winnerId = null;
      let forfeited = false;
      if (newChallengerAfkStreak >= C.MAX_CONSECUTIVE_AFK_ROUNDS && newOpponentAfkStreak < C.MAX_CONSECUTIVE_AFK_ROUNDS) {
        winnerId = battle.opponent_id; forfeited = true;
      } else if (newOpponentAfkStreak >= C.MAX_CONSECUTIVE_AFK_ROUNDS && newChallengerAfkStreak < C.MAX_CONSECUTIVE_AFK_ROUNDS) {
        winnerId = battle.challenger_id; forfeited = true;
      } else if (newChallengerHp <= 0 && newOpponentHp > 0) {
        winnerId = battle.opponent_id;
      } else if (newOpponentHp <= 0 && newChallengerHp > 0) {
        winnerId = battle.challenger_id;
      } else {
        if (newChallengerHp === newOpponentHp) winnerId = null;
        else winnerId = newChallengerHp > newOpponentHp ? battle.challenger_id : battle.opponent_id;
      }

      await battleModel.updateRoundState(battle.id, {
        roundNumber: battle.round_number,
        challengerHp: newChallengerHp, challengerStamina: newChallengerStamina,
        opponentHp: newOpponentHp, opponentStamina: newOpponentStamina,
        challengerAfkStreak: newChallengerAfkStreak, opponentAfkStreak: newOpponentAfkStreak,
        state: battleModel.STATES.RESOLVING,
        challengerLockedMove: null, opponentLockedMove: null, activeEffects: [],
      });

      const finished = await battleModel.finishBattle(battle.id, winnerId);
      await finalizeBattle(finished, chatId, { forfeited });
      return;
    }

    await battleModel.updateRoundState(battle.id, {
      roundNumber: battle.round_number + 1,
      challengerHp: newChallengerHp, challengerStamina: newChallengerStamina,
      opponentHp: newOpponentHp, opponentStamina: newOpponentStamina,
      challengerAfkStreak: newChallengerAfkStreak, opponentAfkStreak: newOpponentAfkStreak,
      state: battleModel.STATES.WAITING_FOR_MOVES,
      challengerLockedMove: nextChallengerLockedMove, opponentLockedMove: nextOpponentLockedMove,
      activeEffects: nextActiveEffects,
    });

    const updatedBattle = await battleModel.getBattle(battle.id);
    await sendRoundMessage(updatedBattle, chatId);
  }

  async function finalizeBattle(battle, chatId, { forfeited = false } = {}) {
    clearTimer(roundTimers, battle.id);
    clearRoundBookkeeping(battle.id);

    const challenger = await userModel.getUser(battle.challenger_id);
    const opponent = await userModel.getUser(battle.opponent_id);
    const isDraw = battle.winner_id === null;
    const winnerId = battle.winner_id;

    let cStats = await playerStatsModel.getPlayerStats(battle.challenger_id, battle.group_id);
    let oStats = await playerStatsModel.getPlayerStats(battle.opponent_id, battle.group_id);

    // Persist HP/stamina at end of fight (regen will happen passively later).
    cStats = await playerStatsModel.updatePlayerStats(battle.challenger_id, battle.group_id, {
      hp: battle.challenger_hp, stamina: battle.challenger_stamina, total_fights: cStats.total_fights + 1,
    });
    oStats = await playerStatsModel.updatePlayerStats(battle.opponent_id, battle.group_id, {
      hp: battle.opponent_hp, stamina: battle.opponent_stamina, total_fights: oStats.total_fights + 1,
    });

    await groupModel.incrementGroupCounters(battle.group_id, { duels: 1 });

    let resultText = `🏆 <b>دوئل به پایان رسید</b>\n\n`;

    if (isDraw) {
      resultText += `⚔️ دوئل بین ${escapeHtml(challenger.display_name)} و ${escapeHtml(opponent.display_name)} مساوی شد!\n\n`;
      resultText += `Eris: "هیچ‌کدامتان تحت تأثیرم قرار ندادید. بروید تمرین کنید."`;
      await battleModel.updateRoundState(battle.id, {
        roundNumber: battle.round_number, challengerHp: battle.challenger_hp, challengerStamina: battle.challenger_stamina,
        opponentHp: battle.opponent_hp, opponentStamina: battle.opponent_stamina,
        challengerAfkStreak: 0, opponentAfkStreak: 0, state: battleModel.STATES.FINISHED,
        challengerLockedMove: null, opponentLockedMove: null, activeEffects: [],
      });
      cStats = await playerStatsModel.updatePlayerStats(battle.challenger_id, battle.group_id, { draws: cStats.draws + 1 });
      oStats = await playerStatsModel.updatePlayerStats(battle.opponent_id, battle.group_id, { draws: oStats.draws + 1 });
    } else {
      const winnerUser = winnerId === battle.challenger_id ? challenger : opponent;
      const loserUser = winnerId === battle.challenger_id ? opponent : challenger;
      let winnerStats = winnerId === battle.challenger_id ? cStats : oStats;
      let loserStats = winnerId === battle.challenger_id ? oStats : cStats;
      const winnerHp = winnerId === battle.challenger_id ? battle.challenger_hp : battle.opponent_hp;

      const rewardScale = await getDuplicateOpponentRewardScale(battle.group_id, battle.challenger_id, battle.opponent_id);

      const { winnerGain, loserLoss } = ratingService.computeDuelRatingDeltas(winnerStats.rating, loserStats.rating);
      const scaledRatingGain = Math.max(0, Math.round(winnerGain * rewardScale));
      const scaledRatingLoss = Math.min(loserStats.rating, Math.round(loserLoss * rewardScale));

      const streakResult = streakService.applyWinStreak(winnerStats.current_streak, winnerStats.best_streak);
      const streakMultiplier = streakService.getStreakMultiplier(streakResult.currentStreak);

      const isUpset = loserStats.rating - winnerStats.rating >= 100;
      const xpGain = Math.round(C.XP_PVP_WIN * streakMultiplier * rewardScale);
      const coinGain = Math.round(C.COINS_PVP_WIN * streakMultiplier * rewardScale);
      const respectGain = Math.round((2 + (isUpset ? 3 : 0)) * rewardScale);

      winnerStats = await playerStatsModel.updatePlayerStats(winnerUser.telegram_id, battle.group_id, {
        wins: winnerStats.wins + 1,
        rating: winnerStats.rating + scaledRatingGain,
        current_streak: streakResult.currentStreak,
        best_streak: streakResult.bestStreak,
        eris_respect: winnerStats.eris_respect + respectGain,
      });
      const winnerXp = await xpService.grantXp(winnerUser.telegram_id, battle.group_id, winnerStats, xpGain);
      winnerStats = await coinService.grantCoins(winnerUser.telegram_id, battle.group_id, winnerXp.stats, coinGain, 'PVP_WIN', { battleId: battle.id });

      const loserXp2Gain = Math.round(C.XP_PVP_LOSS * rewardScale);
      const loserCoinGain = Math.round(C.COINS_PVP_LOSS * rewardScale);
      loserStats = await playerStatsModel.updatePlayerStats(loserUser.telegram_id, battle.group_id, {
        losses: loserStats.losses + 1,
        rating: Math.max(0, loserStats.rating - scaledRatingLoss),
        ...streakService.applyLossStreak(),
      });
      const loserXpResult = await xpService.grantXp(loserUser.telegram_id, battle.group_id, loserStats, loserXp2Gain);
      loserStats = await coinService.grantCoins(loserUser.telegram_id, battle.group_id, loserXpResult.stats, loserCoinGain, 'PVP_LOSS', { battleId: battle.id });

      await transactionModel.recordTransaction({
        telegramId: winnerUser.telegram_id, groupId: battle.group_id, type: 'PVP_WIN',
        xpDelta: xpGain, ratingDelta: scaledRatingGain, metadata: { battleId: battle.id },
      });
      await transactionModel.recordTransaction({
        telegramId: loserUser.telegram_id, groupId: battle.group_id, type: 'PVP_LOSS',
        xpDelta: loserXp2Gain, ratingDelta: -scaledRatingLoss, metadata: { battleId: battle.id },
      });

      let rageGain = C.RAGE_PER_PVP_WIN + C.RAGE_PER_PVP_LOSS;
      if (isUpset) rageGain += C.RAGE_PER_UPSET_WIN;
      rageGain += streakService.getStreakRageBonus(streakResult.currentStreak);
      const rageResult = await rageService.addRage(battle.group_id, rageGain);
      if (rageResult.triggeredEvent) {
        await erisEventService.announceEvent(bot.telegram, rageResult.triggeredEvent, chatId, battle.thread_id);
      }

      if (winnerStats.wins === 1) await achievementModel.unlock(winnerUser.telegram_id, battle.group_id, 'FIRST_BLOOD');
      if (streakResult.hitAchievementThreshold) await achievementModel.unlock(winnerUser.telegram_id, battle.group_id, 'UNSTOPPABLE');
      if (isUpset) await achievementModel.unlock(winnerUser.telegram_id, battle.group_id, 'UNDERDOG');

      await dailyChallengeService.onDuelWin(winnerUser.telegram_id, battle.group_id, { beatHigherRated: isUpset });

      resultText +=
      (forfeited
        ? `⚔️ ${escapeHtml(winnerUser.display_name)} پیروز شد — ${escapeHtml(loserUser.display_name)} به‌دلیل عدم حضور تسلیم شد!\n\n`
        : `⚔️ ${escapeHtml(winnerUser.display_name)}، ${escapeHtml(loserUser.display_name)} را شکست داد!\n\n`) +
      `${escapeHtml(winnerUser.display_name)}:\n❤️ ${winnerHp} سلامتی باقی‌مانده\n\n` +
      `${escapeHtml(loserUser.display_name)}:\n❤️ 0 سلامتی\n\n` +
      `پاداش‌ها:\n⭐ +${num(xpGain)} تجربه\n🪙 +${num(coinGain)} سکه\n🏆 +${num(scaledRatingGain)} امتیاز\n🔥 احترام اریس +${num(respectGain)}\n\n` +
      `رکورد پیروزی‌های متوالی:\n🔥 ${streakResult.currentStreak}\n\n` +
      `${escapeHtml(loserUser.display_name)}:\n⭐ +${num(loserXp2Gain)} تجربه\n🪙 +${num(loserCoinGain)} سکه\nامتیاز:\n-${num(scaledRatingLoss)}\n\n` +
      `Eris:\n"${erisVoice.say(streakResult.currentStreak >= 3 ? 'streak' : 'duel_win')}"`;
      if (rewardScale < 1) {
        resultText += `\n\n<i>(پاداش‌ها کاهش یافتند — شما دو نفر اخیراً بیش از حد با یکدیگر مبارزه کرده‌اید.)</i>`;
      }
    }

    // Persist — this IS "گزارش نهایی نتایج نبردها", one of the 3 exempt categories.
    await sendPersist(bot.telegram, chatId, resultText, { parse_mode: 'HTML', ...threadExtra(battle.thread_id) });
  }

  async function sweepExpiredChallenges() {
    const expired = await battleModel.expireStaleBattles();
    for (const battle of expired) {
      clearTimer(challengeTimers, battle.id);
      if (battle.chat_message_id) {
        await bot.telegram.editMessageText(
          battle.group_id, battle.chat_message_id, undefined,
          '⌛ زمان چالش به پایان رسید. کسی به‌موقع قبول نکرد.'
        ).catch(() => {});
      }
    }
  }

  return {
    startChallenge, acceptChallenge, declineChallenge, submitMove, useItem, sweepExpiredChallenges,
  };
}

module.exports = { createBattleManager };
