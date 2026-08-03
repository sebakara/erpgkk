'use strict';

const path = require('path');
const knex = require('knex');
require('dotenv').config();

async function runSeeds() {
  const db = knex.default({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'gkkerp',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'secret',
    },
  });

  try {
    const seedsDir = path.resolve(__dirname, 'dist', 'database', 'seeds');
    const fs = require('fs');
    const files = fs.readdirSync(seedsDir).filter((f) => f.endsWith('.js')).sort();

    for (const file of files) {
      const seed = require(path.join(seedsDir, file));
      await seed.seed(db);
      console.log(`Seed ran: ${file}`);
    }
  } finally {
    await db.destroy();
  }
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
