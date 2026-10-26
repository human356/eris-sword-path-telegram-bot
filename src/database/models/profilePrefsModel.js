'use strict';
const { query } = require('../pool');

async function getPrefs(telegramId, groupId) {
  const { rows } = await query(
    'SELECT template_key, title_key FROM player_profile_prefs WHERE telegram_id = $1 AND group_id = $2',
    [telegramId, groupId]
  );
  return rows[0] || { template_key: null, title_key: null };
}

/** `templateKey` null = back to the free default template. */
async function setTemplate(telegramId, groupId, templateKey) {
  await query(
    `INSERT INTO player_profile_prefs (telegram_id, group_id, template_key, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (telegram_id, group_id) DO UPDATE SET template_key = EXCLUDED.template_key, updated_at = now()`,
    [telegramId, groupId, templateKey]
  );
}

/** `titleKey` null = show no title. */
async function setTitle(telegramId, groupId, titleKey) {
  await query(
    `INSERT INTO player_profile_prefs (telegram_id, group_id, title_key, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (telegram_id, group_id) DO UPDATE SET title_key = EXCLUDED.title_key, updated_at = now()`,
    [telegramId, groupId, titleKey]
  );
}

module.exports = { getPrefs, setTemplate, setTitle };
