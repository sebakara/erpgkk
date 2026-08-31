'use strict';
/**
 * Put KwikKoders people into the company that owns the projects.
 *
 * Production split: imported staff landed in company slug `gkk` (0 projects),
 * while the 25 real projects live in the company Joe registered.
 *
 * Usage:
 *   node apps/api/fix-workspace-company.js
 *   node apps/api/fix-workspace-company.js --apply
 *
 * Env: apps/api/.env
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const knexLib = require('knex');
const { v4: uuid } = require('uuid');

const APPLY = process.argv.includes('--apply');

function dbConnection() {
  const socketPath = process.env.DB_SOCKET;
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'gkkerp',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ...(socketPath ? { socketPath } : {}),
  };
}

async function run(db) {
  const companies = await db('companies').select('id', 'name', 'slug');
  const projectCounts = await db('projects')
    .whereNull('deleted_at')
    .select('company_id')
    .count({ n: '*' })
    .groupBy('company_id')
    .orderBy('n', 'desc');

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('\n── Companies');
  for (const company of companies) {
    const row = projectCounts.find((item) => item.company_id === company.id);
    const n = Number(row?.n ?? 0);
    const people = await db('users').where({ company_id: company.id }).count({ n: '*' }).first();
    console.log(`  ${company.slug || '(no slug)'}  ${company.name}  projects=${n}  users=${people?.n ?? 0}`);
  }

  const targetId = projectCounts[0]?.company_id;
  if (!targetId) {
    throw new Error('No projects found.');
  }
  const target = companies.find((company) => company.id === targetId);
  console.log(`\n── Target workspace\n  ${target.name} (${target.slug})`);

  const people = await db('users')
    .where('company_id', '!=', targetId)
    .where(function () {
      this.where('email', 'like', '%@kwikkoders.com')
        .orWhere('email', 'like', '%maic%')
        .orWhere('job_title', 'like', '%Head of Engineering%');
    })
    .select('id', 'email', 'first_name', 'last_name', 'role', 'job_title', 'company_id', 'department_id');

  console.log(`\n── Users to move (${people.length})`);
  for (const person of people) {
    const from = companies.find((company) => company.id === person.company_id);
    console.log(`  ${person.email}  ${person.role}  ${person.job_title || ''}  from ${from?.slug || from?.name}`);
  }

  if (!people.length) {
    console.log('\nNothing to move. Workspace already aligned.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write.');
    return;
  }

  const sourceDepts = await db('departments').whereIn('company_id', [...new Set(people.map((p) => p.company_id))]);
  const targetDepts = await db('departments').where({ company_id: targetId });
  const deptMap = new Map();
  for (const source of sourceDepts) {
    let dest = targetDepts.find((dept) => dept.name === source.name);
    if (!dest) {
      const id = uuid();
      await db('departments').insert({
        id,
        company_id: targetId,
        name: source.name,
        manager_id: source.manager_id,
      });
      dest = { id, name: source.name, manager_id: source.manager_id };
      targetDepts.push(dest);
      console.log(`  INSERT dept ${source.name}`);
    }
    deptMap.set(source.id, dest.id);
  }

  for (const person of people) {
    await db('users').where({ id: person.id }).update({
      company_id: targetId,
      department_id: person.department_id ? (deptMap.get(person.department_id) || person.department_id) : person.department_id,
      updated_at: new Date(),
    });
    console.log(`  MOVE ${person.email}`);
  }

  const maic = await db('users').where({ email: 'maic.sebakara@kwikkoders.com' }).first();
  const rnd = targetDepts.find((dept) => /r\s*&\s*d|engineering/i.test(dept.name));
  if (maic && rnd) {
    await db('users').where({ id: maic.id }).update({ department_id: rnd.id, updated_at: new Date() });
    await db('departments').where({ id: rnd.id }).update({ manager_id: maic.id, updated_at: new Date() });
    console.log(`  HEAD  ${rnd.name} → Maic`);
  }

  if (rnd) {
    const updated = await db('projects').where({ company_id: targetId }).whereNull('deleted_at').update({
      department_id: rnd.id,
      updated_at: new Date(),
    });
    console.log(`  DEPT  ${updated} projects → ${rnd.name}`);
  }

  console.log('\nDone. Maic should sign out and back in, then open Projects.');
}

async function main() {
  const db = knexLib({ client: 'mysql2', connection: dbConnection() });
  try {
    await run(db);
  } catch (err) {
    console.error('\nFailed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
