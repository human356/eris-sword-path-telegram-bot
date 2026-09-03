'use strict';
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

/**
 * Applies schema.sql. Safe to call every time the bot boots — every
 * statement in schema.sql uses IF NOT EXISTS / ON CONFLICT DO NOTHING, so
 * re-running it never touches existing data or throws on things that
 * already exist.
 */
async function runMigration() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  // eslint-disable-next-line no-console
  console.log('[migrate] applying schema.sql ...');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('[migrate] done.');
}

// Still usable directly from a terminal (`node src/database/migrate.js`) for
// anyone who has shell access — only exits the process in that case.
if (require.main === module) {
  runMigration()
    .then(() => pool.end())
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[migrate] failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigration };
