'use strict';
const { Pool, types } = require('pg');
const env = require('../config/env');

// Telegram user/chat IDs (BIGINT columns) always fit within JS's safe integer
// range, but node-postgres returns BIGINT (OID 20) as strings by default to
// avoid silent precision loss for arbitrary bigints. That default breaks every
// strict-equality check against a Telegram ID elsewhere in this codebase
// (e.g. `telegramId !== battle.challenger_id`), so we opt back into numbers
// specifically for this app.
types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool(
  env.DATABASE_URL
    ? { connectionString: env.DATABASE_URL, ...(env.DATABASE_SSL ? { ssl: { rejectUnauthorized: false } } : {}) }
    : {
        host: env.PGHOST,
        port: env.PGPORT ? Number(env.PGPORT) : 5432,
        user: env.PGUSER,
        password: env.PGPASSWORD,
        database: env.PGDATABASE,
      }
);

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('[db] unexpected error on idle client', err);
});

/**
 * Run a query with plain args.
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a callback inside a single client transaction.
 * Always use this for any multi-statement mutation (e.g. battle resolution,
 * reward payouts) so a crash mid-way never leaves half-applied state.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
