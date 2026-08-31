'use strict';
const dailyModel = require('../database/models/dailyChallengeModel');
const CHALLENGE_DEFS = {

  WIN_3_DUELS: {

    label: 'امروز ۳ دوئل را پیروز شوید.',

    target: 3,

    xp: 100, coins: 150, respect: 5,

  },

  BEAT_HIGHER_RATED: {

    label: 'مبارزی را شکست دهید که امتیازش از شما بیشتر است.',

    target: 1,

    xp: 300, coins: 400, respect: 10,

  },

  TRAIN_TWICE: {

    label: 'امروز ۲ جلسه تمرین را کامل کنید.',

    target: 2,

    xp: 120, coins: 150, respect: 5,

  },

};

function pickRandomChallenge() {

  const keys = Object.keys(CHALLENGE_DEFS);

  const key = keys[Math.floor(Math.random() * keys.length)];

  return {
    challengeKey: key,
    target: CHALLENGE_DEFS[key].target
  };

}

/** پس از پایان یک دوئل PvP برای بازیکن پیروز فراخوانی می‌شود. */

async function onDuelWin(telegramId, groupId, { beatHigherRated }) {

  try {

    await dailyModel.incrementProgress(
      telegramId,
      groupId,
      'WIN_3_DUELS',
      1
    );

    if (beatHigherRated) {

      await dailyModel.incrementProgress(
        telegramId,
        groupId,
        'BEAT_HIGHER_RATED',
        1
      );

    }

  } catch {

    // ممکن است چالش روزانه هنوز برای بازیکن تعیین نشده باشد (برای اولین بار /daily را اجرا نکرده است) — نادیده گرفته می‌شود.

  }

}

/** پس از تکمیل یک جلسه تمرین فراخوانی می‌شود. */

async function onTrainingComplete(telegramId, groupId) {

  try {

    await dailyModel.incrementProgress(
      telegramId,
      groupId,
      'TRAIN_TWICE',
      1
    );

  } catch {

    // مشابه بالا — اگر بازیکن امروز چالش فعالی نداشته باشد، هیچ کاری انجام نمی‌شود.

  }

}
module.exports = { CHALLENGE_DEFS, pickRandomChallenge, onDuelWin, onTrainingComplete };
