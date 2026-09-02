'use strict';
/**
 * Import KwikERP projects, issues, members, and milestones into the company
 * that already owns the workspace (same resolve rule as import-kwikerp-employees.js).
 *
 * Idempotent by project name / issue title. Assigns projects to R&D.
 *
 * Usage:
 *   node apps/api/import-kwikerp-projects.js
 *   node apps/api/import-kwikerp-projects.js --apply
 *
 * Env: apps/api/.env
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const knexLib = require('knex');
const { v4: uuid } = require('uuid');

const APPLY = process.argv.includes('--apply');
const DESCRIPTIONS = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'projects-descriptions.json'), 'utf8'),
);

const SRC_PROJECTS = [
  { src_id: 1, name: 'KWIK DRIVE' },
  { src_id: 2, name: 'Kwik Senda' },
  { src_id: 3, name: 'Kwik ride Dashboard' },
  { src_id: 4, name: 'Rwanda Trauma Registry' },
  { src_id: 5, name: 'Kwik Ride Mobile' },
  { src_id: 6, name: 'Kwik Ride' },
  { src_id: 7, name: 'Kwik ride Mobile' },
  { src_id: 8, name: 'SfH- EMR' },
  { src_id: 9, name: 'NHIC Public Portal' },
  { src_id: 10, name: 'Centralized Teleradiology Platform (DICOM)' },
  { src_id: 11, name: 'Mosquito DB(VectorScope)' },
  { src_id: 12, name: 'Rwanda Health Insurance Portal (RHIP)' },
  { src_id: 13, name: 'National Hygiene & Inspection Portal( NHIP)' },
  { src_id: 14, name: 'Higher Education Council — Foreign Qualification Equivalency MIS( HEC)' },
  { src_id: 15, name: 'Rwanda Health Council Connect (RHCC)' },
  { src_id: 16, name: 'Real-Time Data Ingestion into the NHIC Data Warehouse' },
  { src_id: 17, name: 'New Infrastructure Documentation & Migration Preparation' },
  { src_id: 18, name: 'Data Governance Measures — Implementation & Monitoring' },
  { src_id: 19, name: 'Monthly User Access Audit & Monitoring Dashboard Review' },
  { src_id: 20, name: 'Platform Tooling Expansion for Data Scientists & Analysts' },
  { src_id: 21, name: 'GKK Fellowship Program' },
  { src_id: 22, name: 'HEC Accreditation' },
  { src_id: 23, name: 'e-Buzima' },
  { src_id: 24, name: 'Kwik social' },
];

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308',
  '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7', '#10b981',
  '#f59e0b', '#84cc16', '#0ea5e9', '#d946ef', '#fb923c', '#34d399',
  '#60a5fa', '#c084fc', '#f472b6', '#4ade80', '#38bdf8', '#a78bfa',
];

const STATE_MAP = { in_progress: 'in_progress', approved: 'done', done: 'done' };

// KwikERP users.id → work email (employees.user_id in kwikerp.sql).
const KWIKERP_USER_EMAIL = {
  29: 'josue@kwikkoders.com',
  30: 'tricia.ingabire@kwikkoders.com',
  31: 'maic.sebakara@kwikkoders.com',
  32: 'annie.bwiza@kwikkoders.com',
  33: 'apotre.mwenedata@kwikkoders.com',
  34: 'aimable.byumvuhore@kwikkoders.com',
  35: 'castella.inezacinta@kwikkoders.com',
  36: 'dbellamy.biramahire@kwikkoders.com',
  37: 'divine.itangamahoro@kwikkoders.com',
  38: 'gloire.mbonyimana@kwikkoders.com',
  39: 'heritier.bagumire@kwikkoders.com',
  40: 'jbruno.dushimiyimana@kwikkoders.com',
  41: 'thierry.kamanzi@kwikkoders.com',
  42: 'nicaise.kirezi@kwikkoders.com',
  43: 'mariam.umutesi@kwikkoders.com',
  44: 'mmerveille.kangabire@kwikkoders.com',
  45: 'peace.ishimwe@kwikkoders.com',
  46: 'regis.ndizihiwe@kwikkoders.com',
  47: 'alexis.atibu@kwikkoders.com',
  48: 'meghan.nimwiza@kwikkoders.com',
  49: 'bey.faith@kwikkoders.com',
  50: 'carl.mabuka@kwikkoders.com',
  52: 'derrick.murinzimpano@kwikkoders.com',
};

const EBUZIMA_TEAM = [41, 37, 34, 42];

const SRC_PROJECT_MEMBER_USER_IDS = {
  6: [38, 44],
  9: [34, 42],
  23: [...EBUZIMA_TEAM, 47, 29],
  24: [52],
};

const SRC_TASKS = [
  { title: 'Hosting Via Appstore & Playstore', description: 'Designing the class diagram and the ERD.', state: 'in_progress', project_src_id: 2, due: '2026-04-30' },
  { title: 'Highlighting the need of solving the problem', description: '', state: 'in_progress', project_src_id: 2, due: '2026-04-29' },
  { title: 'Updating users information', description: 'Updating people information.', state: 'in_progress', project_src_id: 2, due: '2026-04-16' },
  { title: 'Telerade', description: 'This task must be done in three days.', state: 'in_progress', project_src_id: 2, due: '2026-04-26' },
  { title: 'Analysing the problem statement', description: '', state: 'in_progress', project_src_id: 4, due: '2026-05-30' },
  { title: 'Demo task', description: '', state: 'in_progress', project_src_id: 4, due: null },
  { title: 'Demo task on this project', description: '', state: 'approved', project_src_id: 4, due: null },
  { title: 'Testing this now', description: '', state: 'in_progress', project_src_id: 4, due: null },
  { title: 'Cloning the current version', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Healthcare (Main Workspace)', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'HIV Module', description: 'All 12 doctypes rebuilt field-accurate. Deployed and verified end-to-end.', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Mental Health Module', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'NCD (Non-Communicable Disease) Module', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'IMCI Module', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Tuberculosis (TB) Module', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Nurse Desk Workspace', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Doctor Desk Workspace', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Reports & Aggregate Reports Pages', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Deep Testing & Bug-Fix Pass', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Other Workspaces (Billing, Pharmacy, Laboratory, Radiology)', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: EBUZIMA_TEAM },
  { title: 'Designing new UI', description: '', state: 'done', project_src_id: 23, due: '2026-08-10', user_ids: [47] },
  { title: 'Cloning and installing the current version', description: '', state: 'in_progress', project_src_id: 24, due: null, user_ids: [52] },
  { title: 'Test', description: '', state: 'in_progress', project_src_id: 23, due: null, user_ids: [29] },
];

const SRC_MILESTONES = [
  { project_src_id: 2, name: 'Payment completion', is_done: true },
  { project_src_id: 2, name: 'Testing & Hosting', is_done: false },
  { project_src_id: 4, name: 'Feasibility study', is_done: true },
];

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

function log(action, message) {
  const prefix = APPLY ? action.padEnd(8) : `WOULD ${action}`.padEnd(14);
  console.log(`  ${prefix} ${message}`);
}

function emailsForUserIds(userIds = []) {
  return [...new Set(userIds.map((id) => KWIKERP_USER_EMAIL[id]).filter(Boolean))];
}

async function ensureMember(db, projectId, userId, role = 'member') {
  const existing = await db('project_members').where({ project_id: projectId, user_id: userId }).first();
  if (existing) return false;
  await db('project_members').insert({ id: uuid(), project_id: projectId, user_id: userId, role });
  return true;
}

async function userIdByEmail(db, companyId, email) {
  const user = await db('users').where({ company_id: companyId, email: email.toLowerCase() }).first('id');
  return user?.id || null;
}

async function resolveCompany(db) {
  const withProjects = await db('projects')
    .whereNull('deleted_at')
    .select('company_id')
    .count({ n: '*' })
    .groupBy('company_id')
    .orderBy('n', 'desc')
    .first();
  if (withProjects?.company_id) {
    return db('companies').where({ id: withProjects.company_id }).first();
  }
  return (await db('companies').where({ slug: 'gkk' }).first())
    || (await db('companies').where({ slug: 'kwikkoders' }).first())
    || db('companies').orderBy('created_at').first();
}

async function importProjects(db) {
  const summary = {
    projects: { insert: 0, exist: 0 },
    issues: { insert: 0, exist: 0, skip: 0 },
    members: { insert: 0, exist: 0 },
    milestones: { insert: 0, exist: 0 },
  };

  console.log(`\nMode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);

  const company = await resolveCompany(db);
  if (!company) throw new Error('No company found. Import employees first.');

  const owner = await db('users').where({ email: 'josue@kwikkoders.com', company_id: company.id }).first()
    || await db('users').where({ email: 'maic.sebakara@kwikkoders.com', company_id: company.id }).first()
    || await db('users').where({ company_id: company.id, role: 'admin' }).first();
  if (!owner) throw new Error('No owner user in the target company (need Josue, Maic, or an admin).');

  const rnd = await db('departments')
    .where({ company_id: company.id })
    .whereNull('deleted_at')
    .where(function () {
      this.where('name', 'like', '%R&D%').orWhere('name', 'like', '%Engineering%');
    })
    .first();

  console.log(`\n── Company\n  USING    ${company.name} (${company.slug})`);
  console.log(`  OWNER    ${owner.email}`);
  console.log(`  R&D      ${rnd ? rnd.name : 'none — projects will have no department'}`);

  console.log('\n── Projects');
  const projIdMap = new Map();
  for (let i = 0; i < SRC_PROJECTS.length; i++) {
    const p = SRC_PROJECTS[i];
    const existing = await db('projects').where({ company_id: company.id, name: p.name }).whereNull('deleted_at').first();
    if (existing) {
      projIdMap.set(p.src_id, existing.id);
      summary.projects.exist += 1;
      log('EXIST', p.name);
      if (APPLY && rnd && existing.department_id !== rnd.id) {
        await db('projects').where({ id: existing.id }).update({ department_id: rnd.id, updated_at: new Date() });
      }
      continue;
    }
    const id = uuid();
    projIdMap.set(p.src_id, id);
    summary.projects.insert += 1;
    log('INSERT', p.name);
    if (APPLY) {
      await db('projects').insert({
        id,
        company_id: company.id,
        owner_id: owner.id,
        department_id: rnd?.id || null,
        name: p.name,
        description: DESCRIPTIONS[String(p.src_id)] || null,
        status: 'active',
        color: COLORS[i % COLORS.length],
      });
      await db('project_members').insert({ id: uuid(), project_id: id, user_id: owner.id, role: 'owner' });
    }
  }

  console.log('\n── Issues');
  let pos = 1;
  for (const t of SRC_TASKS) {
    const projectId = projIdMap.get(t.project_src_id);
    if (!projectId) {
      summary.issues.skip += 1;
      log('SKIP', `"${t.title}" — project not mapped`);
      continue;
    }
    const exists = APPLY || projectId
      ? await db('issues').where({ project_id: projectId, title: t.title }).whereNull('deleted_at').first()
      : null;
    if (exists) {
      summary.issues.exist += 1;
      log('EXIST', t.title);
      if (APPLY && !exists.assignee_id) {
        const assigneeEmail = emailsForUserIds(t.user_ids || [])[0];
        const assigneeId = assigneeEmail ? await userIdByEmail(db, company.id, assigneeEmail) : null;
        if (assigneeId) await db('issues').where({ id: exists.id }).update({ assignee_id: assigneeId, updated_at: new Date() });
      }
      continue;
    }
    summary.issues.insert += 1;
    log('INSERT', `[${STATE_MAP[t.state] || 'in_progress'}] ${t.title}`);
    if (APPLY) {
      const assigneeEmail = emailsForUserIds(t.user_ids || [])[0];
      const assigneeId = assigneeEmail ? await userIdByEmail(db, company.id, assigneeEmail) : null;
      await db('issues').insert({
        id: uuid(),
        project_id: projectId,
        reporter_id: owner.id,
        assignee_id: assigneeId,
        title: t.title,
        description: t.description || null,
        type: 'task',
        priority: 'medium',
        status: STATE_MAP[t.state] || 'in_progress',
        due_date: t.due || null,
        position: pos++,
      });
    }
  }

  console.log('\n── Members');
  const deptUsers = rnd
    ? await db('users').where({ company_id: company.id, department_id: rnd.id, is_active: true }).select('id', 'email')
    : [];
  const extraEmailsByProject = new Map();
  for (const [srcId, userIds] of Object.entries(SRC_PROJECT_MEMBER_USER_IDS)) {
    extraEmailsByProject.set(Number(srcId), emailsForUserIds(userIds));
  }
  for (const t of SRC_TASKS) {
    const emails = emailsForUserIds(t.user_ids || []);
    if (!emails.length) continue;
    extraEmailsByProject.set(t.project_src_id, [...new Set([
      ...(extraEmailsByProject.get(t.project_src_id) || []),
      ...emails,
    ])]);
  }

  for (const p of SRC_PROJECTS) {
    const projectId = projIdMap.get(p.src_id);
    if (!projectId) continue;
    const emails = new Set([
      owner.email.toLowerCase(),
      ...deptUsers.map((u) => u.email.toLowerCase()),
      ...(extraEmailsByProject.get(p.src_id) || []),
    ]);
    for (const email of emails) {
      const userId = await userIdByEmail(db, company.id, email);
      if (!userId) continue;
      const role = userId === owner.id ? 'owner' : 'member';
      const existing = await db('project_members').where({ project_id: projectId, user_id: userId }).first();
      if (existing) {
        summary.members.exist += 1;
        continue;
      }
      summary.members.insert += 1;
      log('INSERT', `${p.name} ← ${email}`);
      if (APPLY) await ensureMember(db, projectId, userId, role);
    }
  }

  console.log('\n── Milestones');
  const hasMilestones = await db.schema.hasTable('milestones');
  if (!hasMilestones) {
    log('SKIP', 'milestones table missing');
  } else {
    for (const m of SRC_MILESTONES) {
      const projectId = projIdMap.get(m.project_src_id);
      if (!projectId) {
        log('SKIP', `"${m.name}" — project not mapped`);
        continue;
      }
      const exists = await db('milestones').where({ project_id: projectId, name: m.name }).first();
      if (exists) {
        summary.milestones.exist += 1;
        log('EXIST', m.name);
        continue;
      }
      summary.milestones.insert += 1;
      log('INSERT', m.name);
      if (APPLY) {
        await db('milestones').insert({
          id: uuid(),
          project_id: projectId,
          name: m.name,
          is_done: m.is_done ? 1 : 0,
        });
      }
    }
  }

  console.log('\n── Summary');
  console.log(`  Projects    insert ${summary.projects.insert}  exist ${summary.projects.exist}`);
  console.log(`  Issues      insert ${summary.issues.insert}  exist ${summary.issues.exist}  skip ${summary.issues.skip}`);
  console.log(`  Members     insert ${summary.members.insert}  exist ${summary.members.exist}`);
  console.log(`  Milestones  insert ${summary.milestones.insert}  exist ${summary.milestones.exist}`);
  if (!APPLY) console.log('\nDry-run only. Re-run with --apply to write these rows.');
  else console.log('\nProject import complete.');
}

async function main() {
  const db = knexLib.default({ client: 'mysql2', connection: dbConnection() });
  try {
    if (APPLY) await db.transaction((trx) => importProjects(trx));
    else await importProjects(db);
  } catch (err) {
    console.error('\nImport failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
