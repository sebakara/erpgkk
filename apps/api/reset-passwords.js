'use strict';
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const knexLib = require('knex');
const bcrypt  = require('bcryptjs');

async function main() {
  const db = knexLib.default({
    client: 'mysql2',
    connection: {
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT || 3306),
      user:     process.env.DB_USER     || 'kwikcomp',
      password: process.env.DB_PASSWORD || 'Kwikops@123',
      database: process.env.DB_NAME     || 'gkkerp',
    },
  });

  try {
    const hash = await bcrypt.hash('12345678', 12);
    const count = await db('users').update({ password_hash: hash });
    console.log(`✓ Updated password for ${count} user(s) → 12345678`);
  } finally {
    await db.destroy();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
