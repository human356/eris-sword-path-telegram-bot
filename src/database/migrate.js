'use strict';
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  // eslint-disable-next-line no-console
  console.log('[migrate] applying schema.sql ...');
  await pool.query(sql);
  // eslint-disable-next-line no-console
  console.log('[migrate] done.');
  await pool.end();
}

migrate().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate] failed:', err);
  process.exit(1);
});
