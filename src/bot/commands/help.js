'use strict';

const HELP_TEXT =
  `⚔️ <b>ERIS — SWORD PATH</b>\n\n` +
  `This game only works inside a group chat.\n\n` +
  `<b>Player commands</b>\n` +
  `/start — create your profile / open the main menu\n` +
  `/profile — view your Sword Profile\n` +
  `/fight — reply to someone (or /fight @username) to challenge them to a duel\n` +
  `/train — train a stat (Strength, Speed, Defense, Accuracy)\n` +
  `/rank — see your Sword Rank and what's needed for the next one\n` +
  `/stats — see your lifetime stats\n` +
  `/top — this group's leaderboard\n` +
  `/globaltop — the global leaderboard across all groups\n` +
  `/daily — today's Eris challenge and its reward\n` +
  `/rage — check the group's current Eris Rage meter\n` +
  `/event — see or join the active Eris Challenge event\n` +
  `/help — show this message\n\n` +
  `<b>How a duel works</b>\n` +
  `Challenge someone, they Accept/Decline, then you both privately pick a move each round: ` +
  `Attack, Heavy Attack, Guard, Dodge, or Counter. Moves resolve simultaneously. Win to gain XP, ` +
  `Coins, Rating, and Eris's grudging respect.\n\n` +
  `Every duel, training session, and daily challenge slowly fills the group's Eris Rage meter. ` +
  `At 100% Eris challenges the whole group to an event — everyone gets one attack on her, and the ` +
  `top damage dealers win big rewards.`;

function register(bot) {
  bot.command('help', async (ctx) => {
    await ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
  });
}

module.exports = { register, HELP_TEXT };
