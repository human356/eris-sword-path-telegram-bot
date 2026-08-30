'use strict';
const C = require('../config/constants');
const battleModel = require('../database/models/battleModel');
const playerStatsModel = require('../database/models/playerStatsModel');
const userModel = require('../database/models/userModel');
const transactionModel = require('../database/models/transactionModel');
const groupModel = require('../database/models/groupModel');
const { withTransaction } = require('../database/pool');

const engine = require('./battleEngine');
const xpService = require('../ranking/xpService');
const ratingService = require('../ranking/ratingService');
const streakService = require('../ranking/streakService');
const coinService = require('../economy/coinService');
const rageService = require('../eris/rageService');
const erisVoice = require('../eris/erisVoice');
const achievementModel = require('../database/models/achievementModel');
const dailyChallengeService = require('../services/dailyChallengeService');
const erisEventService = require('../events/erisEventService');
const { getDuplicateOpponentRewardScale } = require('../utils/antiAbuse');
const { progressBar, num, escapeHtml } = require('../utils/format');
const { moveKeyboard, challengeKeyboard } = require('../bot/keyboards');

// In-memory timers, keyed by battle id. A single bot process owns these;
// all authoritative state still lives in Postgres (spec §28, §32).
const roundTimers = new Map();
const challengeTimers = new Map();
// Pending moves collected for the current round before both sides are in.
const pendingMoves = new Map(); // battleId -> { [telegramId]: move }

function clearTimer(map, battleId) {
  const t = map.get(battleId);
  if (t) {
    clearTimeout(t);
    map.delete(battleId);
  }
}

function statsSnapshot(stats) {
  return {
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    critChance: Number(stats.crit_chance),
    stamina: stats.stamina,
    hp: stats.hp,
  };
}

function rankLabel(swordRankKey) {
  const { getRankByKey } = require('../utils/rankUtil');
  const r = getRankByKey(swordRankKey);
  return r ? r.label : swordRankKey;
}

function createBattleManager(bot) {
  async function startChallenge({ groupId, challengerUser, opponentUser, chatId }) {
    const challengerStats = (await playerStatsModel.getOrCreatePlayerStats(challengerUser.telegramId, groupId)).stats;
    const opponentStats = (await playerStatsModel.getOrCreatePlayerStats(opponentUser.telegramId, groupId)).stats;

    const battle = await battleModel.createBattle({
      groupId,
      challengerId: challengerUser.telegramId,
      opponentId: opponentUser.telegramId,
      challengerStats,
      opponentStats,
    });

    const text =
      `⚔️ <b>DUEL CHALLENGE</b>\n\n` +
      `${escapeHtml(challengerUser.displayName)} challenged ${escapeHtml(opponentUser.displayName)}!\n\n` +
      `${escapeHtml(challengerUser.displayName)}:\n⚔️ ${rankLabel(challengerStats.sword_rank)}\n❤️ ${challengerStats.hp} HP\n⚡ ${challengerStats.stamina} Stamina\n\n` +
      `${escapeHtml(opponentUser.displayName)}:\n⚔️ ${rankLabel(opponentStats.sword_rank)}\n❤️ ${opponentStats.hp} HP\n⚡ ${opponentStats.stamina} Stamina`;

    const sent = await bot.telegram.sendMessage(chatId, text, {
      parse_mode: 'HTML',
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
        '⌛ The challenge expired. Nobody accepted in time.');
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
        `❌ Challenge declined.\n\nEris: "${erisVoice.say('challenge_declined')}"`
      );
    }
    return battle;
  }

  async function sendRoundMessage(battle, chatId) {
    const challenger = await userModel.getUser(battle.challenger_id);
    const opponent = await userModel.getUser(battle.opponent_id);

    const text =
      `⚔️ <b>DUEL — ROUND ${battle.round_number}</b>\n\n` +
      `👤 ${escapeHtml(challenger.display_name)}\n❤️ ${battle.challenger_hp} / 100  ⚡ ${battle.challenger_stamina} / 100\n\n` +
      `👤 ${escapeHtml(opponent.display_name)}\n❤️ ${battle.opponent_hp} / 100  ⚡ ${battle.opponent_stamina} / 100\n\n` +
      `Choose your move: (⏱ ${C.ROUND_TIMEOUT_SECONDS}s)`;

    const message = await bot.telegram.editMessageText(
      chatId, battle.chat_message_id, undefined, text,
      { parse_mode: 'HTML', ...moveKeyboard(battle.id) }
    ).catch(() =>
      bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...moveKeyboard(battle.id) })
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
    const stamina = isChallenger ? battle.challenger_stamina : battle.opponent_stamina;
    const cost = engine.STAMINA_COST[move];
    if (cost === undefined) return { accepted: false, reason: 'INVALID_MOVE' };
    if (stamina < cost) return { accepted: false, reason: 'NO_STAMINA' };

    const moves = pendingMoves.get(battleId) || {};
    if (moves[telegramId]) return { accepted: false, reason: 'ALREADY_MOVED' };
    moves[telegramId] = move;
    pendingMoves.set(battleId, moves);

    const bothIn = moves[battle.challenger_id] && moves[battle.opponent_id];
    if (bothIn) {
      clearTimer(roundTimers, battleId);
      await resolveRound(battle, moves, chatId);
      pendingMoves.delete(battleId);
    }

    return { accepted: true, waitingForOpponent: !bothIn };
  }

  async function forceResolveRound(battleId, chatId) {
    const battle = await battleModel.getBattle(battleId);
    if (!battle || battle.state !== battleModel.STATES.WAITING_FOR_MOVES) return;

    const moves = pendingMoves.get(battleId) || {};
    if (!moves[battle.challenger_id]) {
      moves[battle.challenger_id] = engine.autoDefensiveMove(battle.challenger_stamina);
    }
    if (!moves[battle.opponent_id]) {
      moves[battle.opponent_id] = engine.autoDefensiveMove(battle.opponent_stamina);
    }
    await resolveRound(battle, moves, chatId, true);
    pendingMoves.delete(battleId);
  }

  async function resolveRound(battle, moves, chatId, wasTimeout = false) {
    const cMove = moves[battle.challenger_id];
    const oMove = moves[battle.opponent_id];

    const cAfk = cMove === null || cMove === undefined;
    const oAfk = oMove === null || oMove === undefined;

    const cStats = { attack: 0, defense: 0, speed: 0, critChance: 0, stamina: battle.challenger_stamina, hp: battle.challenger_hp };
    const oStats = { attack: 0, defense: 0, speed: 0, critChance: 0, stamina: battle.opponent_stamina, hp: battle.opponent_hp };

    // Pull real combat stats (attack/defense/speed/crit) from player_group_stats.
    const cPlayer = await playerStatsModel.getPlayerStats(battle.challenger_id, battle.group_id);
    const oPlayer = await playerStatsModel.getPlayerStats(battle.opponent_id, battle.group_id);
    Object.assign(cStats, statsSnapshot(cPlayer), { hp: battle.challenger_hp, stamina: battle.challenger_stamina });
    Object.assign(oStats, statsSnapshot(oPlayer), { hp: battle.opponent_hp, stamina: battle.opponent_stamina });

    let aDamageDealt = 0;
    let bDamageDealt = 0;
    let log = [];

    if (!cAfk && !oAfk) {
      const result = engine.resolveRound(cMove, cStats, oMove, oStats);
      aDamageDealt = result.aDamageDealt;
      bDamageDealt = result.bDamageDealt;
      log = result.log;
    } else if (!cAfk && oAfk) {
      // opponent has no stamina to even guard: challenger's move still costs stamina but always lands (undefended)
      const result = engine.resolveRound(cMove, cStats, engine.MOVES.GUARD, oStats);
      aDamageDealt = result.aDamageDealt;
      log = result.log;
      log.push('Opponent was too exhausted to react!');
    } else if (cAfk && !oAfk) {
      const result = engine.resolveRound(engine.MOVES.GUARD, cStats, oMove, oStats);
      bDamageDealt = result.bDamageDealt;
      log = result.log;
      log.push('Challenger was too exhausted to react!');
    } else {
      log.push('Both fighters staggered — no clean hits this round.');
    }

    const cCostMove = cMove || engine.MOVES.GUARD;
    const oCostMove = oMove || engine.MOVES.GUARD;
    const cCost = cAfk ? 0 : engine.STAMINA_COST[cCostMove];
    const oCost = oAfk ? 0 : engine.STAMINA_COST[oCostMove];

    const newChallengerHp = Math.max(0, battle.challenger_hp - bDamageDealt);
    const newOpponentHp = Math.max(0, battle.opponent_hp - aDamageDealt);
    const newChallengerStamina = Math.max(0, battle.challenger_stamina - cCost);
    const newOpponentStamina = Math.max(0, battle.opponent_stamina - oCost);

    const newChallengerAfkStreak = cAfk ? battle.challenger_afk_streak + 1 : 0;
    const newOpponentAfkStreak = oAfk ? battle.opponent_afk_streak + 1 : 0;

    await battleModel.recordRound(battle.id, battle.round_number, {
      challengerMove: cMove, opponentMove: oMove,
      challengerDamageDealt: aDamageDealt, opponentDamageDealt: bDamageDealt, log,
    });

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
        // Tie or double-KO / round cap reached: higher remaining HP wins; true tie -> draw.
        if (newChallengerHp === newOpponentHp) winnerId = null;
        else winnerId = newChallengerHp > newOpponentHp ? battle.challenger_id : battle.opponent_id;
      }

      await battleModel.updateRoundState(battle.id, {
        roundNumber: battle.round_number,
        challengerHp: newChallengerHp, challengerStamina: newChallengerStamina,
        opponentHp: newOpponentHp, opponentStamina: newOpponentStamina,
        challengerAfkStreak: newChallengerAfkStreak, opponentAfkStreak: newOpponentAfkStreak,
        state: battleModel.STATES.RESOLVING,
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
    });

    const updatedBattle = await battleModel.getBattle(battle.id);
    await sendRoundMessage(updatedBattle, chatId);
  }

  async function finalizeBattle(battle, chatId, { forfeited = false } = {}) {
    clearTimer(roundTimers, battle.id);

    const challenger = await userModel.getUser(battle.challenger_id);
    const opponent = await userModel.getUser(battle.opponent_id);
    const isDraw = battle.winner_id === null;
    const winnerId = battle.winner_id;
    const loserId = winnerId === battle.challenger_id ? battle.opponent_id : battle.challenger_id;

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

    let resultText = `🏆 <b>DUEL FINISHED</b>\n\n`;

    if (isDraw) {
      resultText += `⚔️ It's a draw between ${escapeHtml(challenger.display_name)} and ${escapeHtml(opponent.display_name)}!\n\n`;
      resultText += `Eris: "Neither of you impressed me. Go train."`;
      await battleModel.updateRoundState(battle.id, {
        roundNumber: battle.round_number, challengerHp: battle.challenger_hp, challengerStamina: battle.challenger_stamina,
        opponentHp: battle.opponent_hp, opponentStamina: battle.opponent_stamina,
        challengerAfkStreak: 0, opponentAfkStreak: 0, state: battleModel.STATES.FINISHED,
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

      const isUpset = loserStats.rating - winnerStats.rating >= 100; // winner beat a notably stronger foe
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

      // Rage
      let rageGain = C.RAGE_PER_PVP_WIN + C.RAGE_PER_PVP_LOSS;
      if (isUpset) rageGain += C.RAGE_PER_UPSET_WIN;
      rageGain += streakService.getStreakRageBonus(streakResult.currentStreak);
      const rageResult = await rageService.addRage(battle.group_id, rageGain);
      if (rageResult.triggeredEvent) {
        await erisEventService.announceEvent(bot.telegram, rageResult.triggeredEvent, chatId);
      }

      // Achievements
      if (winnerStats.wins === 1) await achievementModel.unlock(winnerUser.telegram_id, battle.group_id, 'FIRST_BLOOD');
      if (streakResult.hitAchievementThreshold) await achievementModel.unlock(winnerUser.telegram_id, battle.group_id, 'UNSTOPPABLE');
      if (isUpset) await achievementModel.unlock(winnerUser.telegram_id, battle.group_id, 'UNDERDOG');

      // Daily challenge progress (spec §21)
      await dailyChallengeService.onDuelWin(winnerUser.telegram_id, battle.group_id, { beatHigherRated: isUpset });

      resultText +=
        (forfeited
          ? `⚔️ ${escapeHtml(winnerUser.display_name)} wins — ${escapeHtml(loserUser.display_name)} forfeited (AFK)!\n\n`
          : `⚔️ ${escapeHtml(winnerUser.display_name)} defeated ${escapeHtml(loserUser.display_name)}!\n\n`) +
        `${escapeHtml(winnerUser.display_name)}:\n❤️ ${winnerHp} HP remaining\n\n` +
        `${escapeHtml(loserUser.display_name)}:\n❤️ 0 HP\n\n` +
        `Rewards:\n⭐ +${num(xpGain)} XP\n🪙 +${num(coinGain)} Coins\n🏆 +${num(scaledRatingGain)} Rating\n🔥 Eris Respect +${num(respectGain)}\n\n` +
        `Win Streak:\n🔥 ${streakResult.currentStreak}\n\n` +
        `${escapeHtml(loserUser.display_name)}:\n⭐ +${num(loserXp2Gain)} XP\n🪙 +${num(loserCoinGain)} Coins\nRating:\n-${num(scaledRatingLoss)}\n\n` +
        `Eris:\n"${erisVoice.say(streakResult.currentStreak >= 3 ? 'streak' : 'duel_win')}"`;

      if (rewardScale < 1) {
        resultText += `\n\n<i>(Rewards reduced — you two have fought a lot recently.)</i>`;
      }
    }

    await bot.telegram.sendMessage(chatId, resultText, { parse_mode: 'HTML' });
  }

  async function sweepExpiredChallenges() {
    const expired = await battleModel.expireStaleBattles();
    for (const battle of expired) {
      clearTimer(challengeTimers, battle.id);
      if (battle.chat_message_id) {
        await bot.telegram.editMessageText(
          battle.group_id, battle.chat_message_id, undefined,
          '⌛ The challenge expired. Nobody accepted in time.'
        ).catch(() => {});
      }
    }
  }

  return {
    startChallenge, acceptChallenge, declineChallenge, submitMove, sweepExpiredChallenges,
  };
}

module.exports = { createBattleManager };
