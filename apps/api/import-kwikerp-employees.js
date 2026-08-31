'use strict';
/**
 * Employee-only import from kwikerp.sql into the current GKK ERP database.
 *
 * Imports departments, users, department managers, reports_to, and onboarding
 * fields. Does not create a database, send invites, or import projects/leave.
 *
 * Usage:
 *   node apps/api/import-kwikerp-employees.js
 *   node apps/api/import-kwikerp-employees.js --apply
 *
 * Env: apps/api/.env  (DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const knexLib = require('knex');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');

const APPLY = process.argv.includes('--apply');
const DEFAULT_PASSWORD = '12345678';

const SRC_DEPARTMENTS = [
  { src_id: 22, name: 'Administration' },
  { src_id: 28, name: 'Marketing & Sales' },
  { src_id: 29, name: 'R&D Department' },
  { src_id: 30, name: 'Finance & Accounting' },
  { src_id: 33, name: 'HR Department' },
  { src_id: 34, name: 'Business Development' },
  { src_id: 35, name: 'Management' },
];

// src_id is employees_employees.id. reports_to_src_id is parent employee id.
const SRC_USERS = [
  {
    src_id: 65, email: 'josue@kwikkoders.com',
    first_name: 'Josue', last_name: 'Mutabazi',
    job_title: 'CEO', role: 'admin',
    phone: null, dept_src_id: 22, reports_to_src_id: null,
    manager_dept_src_id: 22,
    address: null, nid: null,
    bank_name: null, bank_account_name: null, bank_account_number: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relation: null,
  },
  {
    src_id: 66, email: 'tricia.ingabire@kwikkoders.com',
    first_name: 'Tricia', last_name: 'Ingabire',
    job_title: 'Head of Operations', role: 'manager',
    phone: '+250784500003', dept_src_id: 35, reports_to_src_id: null,
    manager_dept_src_id: 35,
    address: 'Kigali, Kabeza', nid: '1199670053906282',
    bank_name: 'Equity Bank', bank_account_name: 'Tricia Ingabire', bank_account_number: '4002113166706',
    emergency_contact_name: 'Nshuti Karake', emergency_contact_phone: '+250 788 325 340', emergency_contact_relation: 'Friend',
  },
  {
    src_id: 67, email: 'maic.sebakara@kwikkoders.com',
    first_name: 'Maic', last_name: 'Sebakara',
    job_title: 'Head of Engineering', role: 'manager',
    phone: '0786 091 893', dept_src_id: 29, reports_to_src_id: 65,
    manager_dept_src_id: 29,
    address: 'Kicukiro - Kigali', nid: '1199480114404285',
    bank_name: 'Equity Bank', bank_account_name: 'Maic Sebakara', bank_account_number: '4025112886966',
    emergency_contact_name: 'Adolf Sebakara', emergency_contact_phone: '0 780 431 960', emergency_contact_relation: 'Brother',
  },
  {
    src_id: 68, email: 'annie.bwiza@kwikkoders.com',
    first_name: 'Annie', last_name: 'Bwiza',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0782548507', dept_src_id: 29, reports_to_src_id: 67,
    address: 'KK 794 st, Kicukiro, Kigarama', nid: '1200570033550142',
    bank_name: 'Equity Bank', bank_account_name: 'Bwiza Annie Pierré', bank_account_number: '4002101073549',
    emergency_contact_name: 'Niyonambaza Lainilde', emergency_contact_phone: '0788460416', emergency_contact_relation: 'Mother',
  },
  {
    src_id: 69, email: 'apotre.mwenedata@kwikkoders.com',
    first_name: 'Apotre', last_name: 'Mwenedata',
    job_title: 'Software Engineer', role: 'employee',
    phone: null, dept_src_id: 29, reports_to_src_id: 67,
    address: null, nid: null,
    bank_name: null, bank_account_name: null, bank_account_number: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relation: null,
  },
  {
    src_id: 70, email: 'aimable.byumvuhore@kwikkoders.com',
    first_name: 'Aimable', last_name: 'Byumvuhore',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0796004898', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Kigali', nid: '1199780233034090',
    bank_name: 'Bank of Kigali', bank_account_name: 'Aimable BYUMVUHORE', bank_account_number: '100244933135',
    emergency_contact_name: 'NYIRAMINANI Suzana', emergency_contact_phone: '0799631745', emergency_contact_relation: 'My Mother',
  },
  {
    src_id: 71, email: 'castella.inezacinta@kwikkoders.com',
    first_name: 'Castella', last_name: 'Ineza Cinta',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0793753931', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Kigali-Rwanda', nid: '1200570252130186',
    bank_name: 'Bank of Kigali', bank_account_name: 'Ineza Cinta Castella', bank_account_number: '100232517152',
    emergency_contact_name: 'Uwimana Dorothee', emergency_contact_phone: '0786162616', emergency_contact_relation: 'Mother',
  },
  {
    src_id: 72, email: 'dbellamy.biramahire@kwikkoders.com',
    first_name: 'Dan Bellamy', last_name: 'Biramahire',
    job_title: 'Software Engineer', role: 'employee',
    phone: '+250 782 957 775', dept_src_id: 29, reports_to_src_id: 67,
    address: 'KN1 Avenue, Kigali, Rwanda', nid: '1200580088252062',
    bank_name: 'Bank of Kigali (BK)', bank_account_name: 'Dan Bellamy BIRAMAHIRE', bank_account_number: '100188963417',
    emergency_contact_name: 'Yvan Ralph Ishimwe', emergency_contact_phone: '+250 780 833 335', emergency_contact_relation: 'Brother',
  },
  {
    src_id: 73, email: 'divine.itangamahoro@kwikkoders.com',
    first_name: 'Divine', last_name: 'Itangamahoro',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0796322039', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Remera', nid: '1200670221279056',
    bank_name: 'Bank of Kigali', bank_account_name: 'Divine Itangamahoro', bank_account_number: '100212469674',
    emergency_contact_name: 'Josiane Nyiramisago', emergency_contact_phone: '0788665768', emergency_contact_relation: 'Mother',
  },
  {
    src_id: 74, email: 'gloire.mbonyimana@kwikkoders.com',
    first_name: 'Gloire', last_name: 'Mbonyimana',
    job_title: 'Software Engineer', role: 'employee',
    phone: null, dept_src_id: 29, reports_to_src_id: 67,
    address: null, nid: null,
    bank_name: null, bank_account_name: null, bank_account_number: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relation: null,
  },
  {
    src_id: 75, email: 'heritier.bagumire@kwikkoders.com',
    first_name: 'Heritier', last_name: 'Bagumire',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0790105852', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Runda-Kamonyi', nid: '1200680000402047',
    bank_name: 'Bank of Kigali', bank_account_name: 'HERTIER BAGUMIRE', bank_account_number: '100193963778',
    emergency_contact_name: 'Emmanuel BAGUMIRE', emergency_contact_phone: '0784504515', emergency_contact_relation: 'Father',
  },
  {
    src_id: 76, email: 'jbruno.dushimiyimana@kwikkoders.com',
    first_name: 'Jazzy Bruno', last_name: 'Dushimiyimana',
    job_title: 'Devops', role: 'employee',
    phone: '0784042344', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Bugesera, Nyamata', nid: '1200680085130048',
    bank_name: 'Bank Of Kigali', bank_account_name: 'JAZZY BRUNO DUSHIMIYIMANA', bank_account_number: '100131421367',
    emergency_contact_name: 'DUSHIMIYIMANA Ildephonse', emergency_contact_phone: '0784042344', emergency_contact_relation: 'FATHER',
  },
  {
    src_id: 77, email: 'thierry.kamanzi@kwikkoders.com',
    first_name: 'Kamanzi Thierry', last_name: 'Ishimwe',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0787991698', dept_src_id: 29, reports_to_src_id: 67,
    address: 'kk362 st 10', nid: '1200280164935035',
    bank_name: 'Zigama CSS', bank_account_name: 'Kamanzi Ishimwe Thierry', bank_account_number: '775375',
    emergency_contact_name: 'Kamanzi Jean Damour', emergency_contact_phone: '0788307155', emergency_contact_relation: 'Father',
  },
  {
    src_id: 78, email: 'nicaise.kirezi@kwikkoders.com',
    first_name: 'Shimwa Kirezi', last_name: 'Nicaise',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0781590359', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Gicumbi, Rwanda', nid: '1200770053033068',
    bank_name: 'Equity Bank', bank_account_name: 'SHIMWA KIREZI Nicaise', bank_account_number: '4018113099909',
    emergency_contact_name: 'UMUNYURWA Ernestine', emergency_contact_phone: '0788567052', emergency_contact_relation: 'Mother',
  },
  {
    src_id: 79, email: 'mariam.umutesi@kwikkoders.com',
    first_name: 'Mariam', last_name: 'Umutesi',
    job_title: 'Graphic Design', role: 'employee',
    phone: '0788929705', dept_src_id: 29, reports_to_src_id: 67,
    address: 'GASABO/BUMBOGO/KAMI', nid: '1199770001431140',
    bank_name: 'EQUITY BANK', bank_account_name: 'Umutesi Mariam', bank_account_number: '4026200028751',
    emergency_contact_name: 'Ntiruhungwa Bikman', emergency_contact_phone: '0785389000', emergency_contact_relation: 'Husband',
  },
  {
    src_id: 80, email: 'mmerveille.kangabire@kwikkoders.com',
    first_name: 'Merveille', last_name: 'Muhoza Kangabire',
    job_title: 'Software Engineer', role: 'employee',
    phone: '+250781894030', dept_src_id: 29, reports_to_src_id: 67,
    address: 'kk 330st', nid: '1200470099913012',
    bank_name: 'GT Bank', bank_account_name: 'Kangabire Muhoza Merveille', bank_account_number: '212/128759/1/5135/0',
    emergency_contact_name: 'Ingabire Redempta', emergency_contact_phone: '+250788304087', emergency_contact_relation: 'Mother',
  },
  {
    src_id: 81, email: 'peace.ishimwe@kwikkoders.com',
    first_name: 'Peace', last_name: 'Ishimwe',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0793092863', dept_src_id: 29, reports_to_src_id: 67,
    address: 'KK 718 Street, Kigali', nid: '1200680117801029',
    bank_name: 'Bank Of Kigali', bank_account_name: 'Current Account', bank_account_number: '100194505331',
    emergency_contact_name: 'Munyaneza Yves Maurice', emergency_contact_phone: '0799497114', emergency_contact_relation: 'Sibling',
  },
  {
    src_id: 82, email: 'regis.ndizihiwe@kwikkoders.com',
    first_name: 'Regis', last_name: 'Ndizihiwe',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0788927469', dept_src_id: 29, reports_to_src_id: 67,
    address: 'Kigali, Rwanda', nid: '1200680050239097',
    bank_name: 'EQUITY BANK', bank_account_name: 'NDIZIHIWE REGIS', bank_account_number: '4007101020595',
    emergency_contact_name: 'PACIFIQUE NIYONKURU', emergency_contact_phone: '0780621267', emergency_contact_relation: 'BROTHER',
  },
  {
    src_id: 83, email: 'alexis.atibu@kwikkoders.com',
    first_name: 'Alexis', last_name: 'Atibu',
    job_title: 'Graphic sesigner', role: 'employee',
    phone: '0788452332', dept_src_id: 28, reports_to_src_id: 84,
    address: 'Kigali, Rwanda', nid: '1199780215994103',
    bank_name: 'Bank Of Kigali', bank_account_name: 'Atibu Alexis', bank_account_number: '100255903637',
    emergency_contact_name: 'Mupenda Craven', emergency_contact_phone: '0788318700', emergency_contact_relation: 'Brother',
  },
  {
    src_id: 84, email: 'meghan.nimwiza@kwikkoders.com',
    first_name: 'Meghan', last_name: 'Nimwiza',
    job_title: 'Head of Marketing and Sales', role: 'manager',
    phone: null, dept_src_id: 28, reports_to_src_id: 65,
    manager_dept_src_id: 28,
    address: null, nid: null,
    bank_name: null, bank_account_name: null, bank_account_number: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relation: null,
  },
  {
    src_id: 85, email: 'bey.faith@kwikkoders.com',
    first_name: 'Bey', last_name: 'Faith',
    job_title: 'Product Manager', role: 'manager',
    phone: '0788717782', dept_src_id: 29, reports_to_src_id: 65,
    address: 'Remera', nid: '1199570136049193',
    bank_name: 'Bank of Kigali', bank_account_name: 'Bey Faith', bank_account_number: '100198686357',
    emergency_contact_name: 'Ryumugabe Ismail', emergency_contact_phone: '0788815431', emergency_contact_relation: 'Spouse',
  },
  {
    src_id: 86, email: 'carl.mabuka@kwikkoders.com',
    first_name: 'Carl', last_name: 'Mabuka',
    job_title: 'Head of Business and AI', role: 'manager',
    phone: '0782000522', dept_src_id: 34, reports_to_src_id: 65,
    manager_dept_src_id: 34,
    address: 'kg 39 Ave', nid: '1198780203417148',
    bank_name: 'NCBA', bank_account_name: 'Carl Mabuka', bank_account_number: '2004166010000040',
    emergency_contact_name: 'Reuben Mbonye', emergency_contact_phone: '0786279892', emergency_contact_relation: 'brother',
  },
  {
    src_id: 88, email: 'derrick.murinzimpano@kwikkoders.com',
    first_name: 'Derrick', last_name: 'Murinzi Mpano',
    job_title: 'Internship', role: 'employee',
    phone: null, dept_src_id: 29, reports_to_src_id: 67,
    address: null, nid: null,
    bank_name: null, bank_account_name: null, bank_account_number: null,
    emergency_contact_name: null, emergency_contact_phone: null, emergency_contact_relation: null,
  },
];

const SKIPPED = [
  { email: 'maicseba@gmail.com', reason: 'duplicate/test account for Maic Sebakara' },
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

async function resolveCompany(db) {
  const bySlug = async (slug) => db('companies').where({ slug }).first();
  return (await bySlug('gkk'))
    || (await bySlug('kwikkoders'))
    || db('companies').orderBy('created_at').first();
}

function userRow(id, companyId, deptId, reportsTo, passwordHash, person) {
  return {
    id,
    company_id: companyId,
    department_id: deptId,
    reports_to: reportsTo,
    email: person.email.toLowerCase(),
    password_hash: passwordHash,
    first_name: person.first_name,
    last_name: person.last_name,
    role: person.role,
    job_title: person.job_title,
    phone: person.phone || null,
    nid: person.nid || null,
    address: person.address || null,
    bank_name: person.bank_name || null,
    bank_account_name: person.bank_account_name || null,
    bank_account_number: person.bank_account_number || null,
    emergency_contact_name: person.emergency_contact_name || null,
    emergency_contact_phone: person.emergency_contact_phone || null,
    emergency_contact_relation: person.emergency_contact_relation || null,
    is_active: true,
    onboarding_completed: false,
  };
}

async function importEmployees(db) {
  const summary = { departments: { insert: 0, exist: 0 }, users: { insert: 0, exist: 0, skip: SKIPPED.length } };

  console.log(`\nMode: ${APPLY ? 'APPLY (writes enabled)' : 'DRY-RUN (no writes)'}`);

  const company = await resolveCompany(db);
  if (!company) {
    throw new Error('No company found in the current database. Create or seed a company first.');
  }
  console.log(`\n── Company\n  USING    ${company.name} (${company.slug})`);

  console.log('\n── Skipped source rows');
  for (const skip of SKIPPED) {
    log('SKIP', `${skip.email} — ${skip.reason}`);
  }

  console.log('\n── Departments');
  const deptIdMap = new Map();
  for (const dept of SRC_DEPARTMENTS) {
    const existing = await db('departments')
      .where({ company_id: company.id, name: dept.name })
      .whereNull('deleted_at')
      .first();
    if (existing) {
      deptIdMap.set(dept.src_id, existing.id);
      summary.departments.exist += 1;
      log('EXIST', dept.name);
      continue;
    }
    const id = uuid();
    deptIdMap.set(dept.src_id, id);
    summary.departments.insert += 1;
    log('INSERT', dept.name);
    if (APPLY) {
      await db('departments').insert({ id, company_id: company.id, name: dept.name });
    }
  }

  console.log('\n── Users');
  const userIdMap = new Map();
  for (const person of SRC_USERS) {
    const existing = await db('users').where({ email: person.email.toLowerCase() }).first();
    const deptName = SRC_DEPARTMENTS.find((dept) => dept.src_id === person.dept_src_id)?.name || 'none';
    const managerName = person.reports_to_src_id
      ? SRC_USERS.find((other) => other.src_id === person.reports_to_src_id)
      : null;
    const managerLabel = managerName ? `${managerName.first_name} ${managerName.last_name}` : 'none';

    if (existing) {
      userIdMap.set(person.src_id, existing.id);
      summary.users.exist += 1;
      log('EXIST', `[${person.role}] ${person.first_name} ${person.last_name} <${person.email}> · password ${DEFAULT_PASSWORD}`);
      if (APPLY) {
        const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        await db('users').where({ id: existing.id }).update({
          password_hash: passwordHash,
          is_active: true,
          updated_at: new Date(),
        });
      }
      continue;
    }

    const id = uuid();
    userIdMap.set(person.src_id, id);
    summary.users.insert += 1;
    log(
      'INSERT',
      `[${person.role}] ${person.first_name} ${person.last_name} <${person.email}> · ${deptName} · reports to ${managerLabel} · password ${DEFAULT_PASSWORD}`,
    );

    if (APPLY) {
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
      await db('users').insert(userRow(
        id,
        company.id,
        person.dept_src_id ? deptIdMap.get(person.dept_src_id) || null : null,
        null,
        passwordHash,
        person,
      ));
    }
  }

  console.log('\n── Reports-to');
  for (const person of SRC_USERS) {
    if (!person.reports_to_src_id) continue;
    const userId = userIdMap.get(person.src_id);
    const managerId = userIdMap.get(person.reports_to_src_id);
    if (!userId || !managerId) {
      log('SKIP', `${person.email} — manager not imported`);
      continue;
    }
    const manager = SRC_USERS.find((other) => other.src_id === person.reports_to_src_id);
    log('SET', `${person.first_name} ${person.last_name} → ${manager.first_name} ${manager.last_name}`);
    if (APPLY) {
      await db('users').where({ id: userId }).update({ reports_to: managerId, updated_at: new Date() });
    }
  }

  console.log('\n── Department managers');
  for (const person of SRC_USERS) {
    if (!person.manager_dept_src_id) continue;
    const deptId = deptIdMap.get(person.manager_dept_src_id);
    const managerId = userIdMap.get(person.src_id);
    const dept = SRC_DEPARTMENTS.find((item) => item.src_id === person.manager_dept_src_id);
    if (!deptId || !managerId) continue;
    log('SET', `${dept.name} → ${person.first_name} ${person.last_name}`);
    if (APPLY) {
      await db('departments').where({ id: deptId }).update({ manager_id: managerId, updated_at: new Date() });
    }
  }

  console.log('\n── Summary');
  console.log(`  Departments  insert ${summary.departments.insert}  exist ${summary.departments.exist}`);
  console.log(`  Users        insert ${summary.users.insert}  exist ${summary.users.exist}  skip ${summary.users.skip}`);
  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write these rows.');
  } else {
    console.log(`\nEmployee import complete. Default password for imported accounts: ${DEFAULT_PASSWORD}`);
  }
}

async function main() {
  const db = knexLib.default({
    client: 'mysql2',
    connection: dbConnection(),
  });

  try {
    if (APPLY) {
      await db.transaction((trx) => importEmployees(trx));
    } else {
      await importEmployees(db);
    }
  } catch (err) {
    console.error('\nImport failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

main();
