'use strict';
/**
 * Creates a demo super-admin account: admin@gkk.com / Admin@1234
 * Attaches to the first company found (KwikKoders after import).
 * Safe to run multiple times — skips if the email already exists.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const knexLib = require('knex');
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');

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
    const EMAIL = 'admin@gkk.com';

    const existing = await db('users').where({ email: EMAIL }).first();
    if (existing) {
      console.log(`✓ ${EMAIL} already exists — skipping.`);
      return;
    }

    const company = await db('companies').first();
    if (!company) throw new Error('No company found. Run import-kwikerpnw.js first.');

    const hash = await bcrypt.hash('Admin@1234', 12);
    await db('users').insert({
      id:            uuid(),
      company_id:    company.id,
      email:         EMAIL,
      password_hash: hash,
      first_name:    'Demo',
      last_name:     'Admin',
      role:          'admin',
      job_title:     'Super Admin',
      is_active:     true,
    });

    console.log(`✓ Created super-admin: ${EMAIL} / Admin@1234`);
    console.log(`  Company: ${company.name}`);
  } finally {
    await db.destroy();
  }
}

main().catch(err => { console.error(err.message); process.exit(1); });
