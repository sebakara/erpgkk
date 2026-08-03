'use strict';
/**
 * Full company import: kwikerpnw.sql → GKK ERP
 *
 * Creates (or reuses) the KwikKoders company and imports:
 *   1. Company
 *   2. Departments         (employees_departments)
 *   3. Users / Employees   (users + employees_employees)
 *   4. Job Positions        (employees_job_positions)   — requires migration 010
 *   5. Work Locations       (employees_work_locations)  — requires migration 010
 *   6. Projects             (projects_projects)
 *   7. Issues / Tasks       (projects_tasks)
 *   8. Milestones           (projects_milestones)       — requires migration 010
 *
 * Idempotent — skips rows that already exist (matched by email / name).
 *
 * Usage (from repo root or apps/api/):
 *   node apps/api/import-kwikerpnw.js
 *
 * Env: DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
 *      Falls back to kwikcomp / Kwikops@123 / gkkerp on localhost.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const knexLib  = require('knex');
const { v4: uuid } = require('uuid');

// ── Company ──────────────────────────────────────────────────────────────────

const COMPANY = { name: 'KwikKoders', slug: 'kwikkoders', plan: 'pro' };

// ── Departments ───────────────────────────────────────────────────────────────
// src_id keys match employees_departments.id; used for cross-reference below.

const SRC_DEPARTMENTS = [
  { src_id: 22, name: 'Administration'      },
  { src_id: 28, name: 'Marketing & Sales'   },
  { src_id: 29, name: 'R&D Department'      },
  { src_id: 30, name: 'Finance & Accounting'},
  { src_id: 33, name: 'HR Department'       },
  { src_id: 34, name: 'Business Development'},
  { src_id: 35, name: 'Management'          },
];

// ── Users / Employees ─────────────────────────────────────────────────────────
// Passwords are bcrypt hashes from kwikerpnw ($2y$ → $2b$ swap for bcryptjs).
// role: admin → josue (CEO), manager → heads, employee → everyone else.
// dept_src_id: employees_departments.id the employee belongs to.
// manager_dept_src_id: if set, this user is the manager of that department.

function y2b(hash) { return hash.replace(/^\$2y\$/, '$2b$'); }

const SRC_USERS = [
  {
    src_user_id: 29, email: 'josue@kwikkoders.com',
    first_name: 'Josue',      last_name: 'Mutabazi',
    job_title: 'CEO',         role: 'admin',
    phone: null,              dept_src_id: 22,
    manager_dept_src_id: 22,  // manager of Administration
    pw: y2b('$2y$12$JcVgGZ1cNvNLAIFJTsvJde6UYMN/j5dESXfKuiigAWRlJ7ozy/YO.'),
  },
  {
    src_user_id: 30, email: 'tricia.ingabire@kwikkoders.com',
    first_name: 'Tricia',     last_name: 'Ingabire',
    job_title: 'Head of Operations', role: 'manager',
    phone: '+250784500003',   dept_src_id: 35,
    manager_dept_src_id: 35,  // manager of Management dept
    pw: y2b('$2y$12$pCc5IXEx89YUMS9cnP4M5ODNKomiZLFCqjeXXtXeq6Axm.YHLdpaS'),
  },
  {
    src_user_id: 31, email: 'maic.sebakara@kwikkoders.com',
    first_name: 'Maic',       last_name: 'Sebakara',
    job_title: 'Head of Engineering', role: 'manager',
    phone: '+250786091893',   dept_src_id: 29,
    manager_dept_src_id: 29,  // manager of R&D
    pw: y2b('$2y$12$dRiH226J5uTJ4mEib4yXVeNpYcFBJbX25iOK.MydkfgHqNOn5K3AS'),
  },
  {
    src_user_id: 32, email: 'annie.bwiza@kwikkoders.com',
    first_name: 'Annie',      last_name: 'Bwiza',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0782548507',      dept_src_id: 29,
    pw: y2b('$2y$12$6UOkdxtiWgP3nEhs0EAL9ec7eRYNumsguLhENMzz0DHPu29WovZDK'),
  },
  {
    src_user_id: 33, email: 'apotre.mwenedata@kwikkoders.com',
    first_name: 'Apotre',     last_name: 'Mwenedata',
    job_title: 'Software Engineer', role: 'employee',
    phone: null,              dept_src_id: 29,
    pw: y2b('$2y$12$rQ78uzyHVBL6GerDZRRDiOrurA0FMJ7E7HLOaBXlxtIl5.qDzhSNm'),
  },
  {
    src_user_id: 34, email: 'aimable.byumvuhore@kwikkoders.com',
    first_name: 'Aimable',    last_name: 'Byumvuhore',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0796004898',      dept_src_id: 29,
    pw: y2b('$2y$12$ytb1xA.iosGvP0qppx.5vORm4dtZQt7BRSKYFBPldjp4fCPjURatm'),
  },
  {
    src_user_id: 35, email: 'castella.inezacinta@kwikkoders.com',
    first_name: 'Castella',   last_name: 'Ineza Cinta',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0793753931',      dept_src_id: 29,
    pw: y2b('$2y$12$KI1FhGewHZQc4ns.Y7upWutgdS161jNqILVUNYIvFmKAfY8znyhim'),
  },
  {
    src_user_id: 36, email: 'dbellamy.biramahire@kwikkoders.com',
    first_name: 'Dan Bellamy', last_name: 'Biramahire',
    job_title: 'Software Engineer', role: 'employee',
    phone: '+250782957775',   dept_src_id: 29,
    pw: y2b('$2y$12$fJUCpKOcfVPE3XmkPeA7z.vMFSiXwlc.tFDYTI4PWAaBQ4BUCfiUu'),
  },
  {
    src_user_id: 37, email: 'divine.itangamahoro@kwikkoders.com',
    first_name: 'Divine',     last_name: 'Itangamahoro',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0796322039',      dept_src_id: 29,
    pw: y2b('$2y$12$MrIeU4PN552oXuZeIjjAy.tEhvQwM6eitfa1Q64nV7FPQmGLE24r6'),
  },
  {
    src_user_id: 38, email: 'gloire.mbonyimana@kwikkoders.com',
    first_name: 'Gloire',     last_name: 'Mbonyimana',
    job_title: 'Software Engineer', role: 'employee',
    phone: null,              dept_src_id: 29,
    pw: y2b('$2y$12$nM53yqeZvEXGa.PU2zwes.rYD9wU6jMy0Oe72adQ7UpMd65vuqPCm'),
  },
  {
    src_user_id: 39, email: 'heritier.bagumire@kwikkoders.com',
    first_name: 'Heritier',   last_name: 'Bagumire',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0790105852',      dept_src_id: 29,
    pw: y2b('$2y$12$bnppLwLtclwmUFvbmaSpCuAfIqXSM8G1u2TDtLRmqf9GrnZzsb9pG'),
  },
  {
    src_user_id: 40, email: 'jbruno.dushimiyimana@kwikkoders.com',
    first_name: 'Jazzy Bruno', last_name: 'Dushimiyimana',
    job_title: 'DevOps Engineer', role: 'employee',
    phone: '0784042344',      dept_src_id: 29,
    pw: y2b('$2y$12$Z2VKTS4rvArCBR72j181Ku8Q20tar0hnCFTRnEH75Ezgpxm.mVixW'),
  },
  {
    src_user_id: 41, email: 'thierry.kamanzi@kwikkoders.com',
    first_name: 'Kamanzi Thierry', last_name: 'Ishimwe',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0787991698',      dept_src_id: 29,
    pw: y2b('$2y$12$j5lEOLaLT6liw3TcldLU0O3tAKq1Ia.Qoo50F3IS6AAQ6ZctqjWxy'),
  },
  {
    src_user_id: 42, email: 'nicaise.kirezi@kwikkoders.com',
    first_name: 'Shimwa Kirezi', last_name: 'Nicaise',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0781590359',      dept_src_id: 29,
    pw: y2b('$2y$12$MCxE62MTnsHvekqZlNVPwOtiUwpzLXg59xCG9lV0rdzfCBHmrt6Aq'),
  },
  {
    src_user_id: 43, email: 'mariam.umutesi@kwikkoders.com',
    first_name: 'Mariam',     last_name: 'Umutesi',
    job_title: 'Graphic Designer', role: 'employee',
    phone: '0788929705',      dept_src_id: 29,
    pw: y2b('$2y$12$mq2d0Qz.6vg./r6gw/.XoOgLb9Cl.1cAouskH37wqRBDXV3c4yKVC'),
  },
  {
    src_user_id: 44, email: 'mmerveille.kangabire@kwikkoders.com',
    first_name: 'Merveille',  last_name: 'Muhoza Kangabire',
    job_title: 'Software Engineer', role: 'employee',
    phone: '+250781894030',   dept_src_id: 29,
    pw: y2b('$2y$12$Ci1NH7CibQjJ3RaoKicTNukhtkPskvzENBpL2Yj26lbA9LJ.QEaZC'),
  },
  {
    src_user_id: 45, email: 'peace.ishimwe@kwikkoders.com',
    first_name: 'Peace',      last_name: 'Ishimwe',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0793092863',      dept_src_id: 29,
    pw: y2b('$2y$12$0kh8scBB4BXONa16zx6mgObYVTN5fjscxnaOFRxtRo1Z4PgC3dDQa'),
  },
  {
    src_user_id: 46, email: 'regis.ndizihiwe@kwikkoders.com',
    first_name: 'Regis',      last_name: 'Ndizihiwe',
    job_title: 'Software Engineer', role: 'employee',
    phone: '0788927469',      dept_src_id: 29,
    pw: y2b('$2y$12$F6pSFWosAiLZXSX9cXTZkOCzjBPy1yF0wWA/IRSG6v6SnR4mhgu.K'),
  },
  {
    src_user_id: 47, email: 'alexis.atibu@kwikkoders.com',
    first_name: 'Alexis',     last_name: 'Atibu',
    job_title: 'Graphic Designer', role: 'employee',
    phone: '0788452332',      dept_src_id: 28,
    pw: y2b('$2y$12$b3V9vjIjG6NIpGGCfK5sXu6.qiT1/ew60bYSGKeTDjNZako24fnsa'),
  },
  {
    src_user_id: 48, email: 'meghan.nimwiza@kwikkoders.com',
    first_name: 'Meghan',     last_name: 'Nimwiza',
    job_title: 'Head of Marketing and Sales', role: 'manager',
    phone: null,              dept_src_id: 28,
    manager_dept_src_id: 28,  // manager of Marketing & Sales
    pw: y2b('$2y$12$8IC3wcj7qtUIGk3rc6vJie/lqA6FtWRbgZYuj3cp/gufFAODeSC3K'),
  },
  {
    src_user_id: 49, email: 'bey.faith@kwikkoders.com',
    first_name: 'Bey',        last_name: 'Faith',
    job_title: 'Product Manager', role: 'employee',
    phone: '0788717782',      dept_src_id: 29,
    pw: y2b('$2y$12$JBJSCENl//jr0bEAhSVE2.8WLzzHlHzy1aSAk5X/54D80z4A84/c2'),
  },
  {
    src_user_id: 50, email: 'carl.mabuka@kwikkoders.com',
    first_name: 'Carl',       last_name: 'Mabuka',
    job_title: 'Head of Business and AI', role: 'manager',
    phone: '0782000522',      dept_src_id: 34,
    manager_dept_src_id: 34,  // manager of Business Development
    pw: y2b('$2y$12$17LZsn.UvUGxf9DOGsgS4u5v0kr0IjsawbLltHovypirJ8cMu8enO'),
  },
  {
    src_user_id: 51, email: 'maicseba@gmail.com',
    first_name: 'Mavin',      last_name: 'Mavenge',
    job_title: 'Engineer',    role: 'employee',
    phone: '0738117065',      dept_src_id: null,
    pw: y2b('$2y$12$TIEmxcfippDswW2qEZtQsOlsPX9FIXNFZtbHhdiSUhCN1JAXCGrH2'),
  },
  {
    src_user_id: 52, email: 'derrick.murinzimpano@kwikkoders.com',
    first_name: 'Derrick',    last_name: 'Murinzi Mpano',
    job_title: 'Internship',  role: 'employee',
    phone: null,              dept_src_id: 29,
    pw: y2b('$2y$12$JjY9mfFt.ry6.QCQmDns5.7V3Hfk1x/AsTnxLQr0iEY772XsqpLdG'),
  },
];

// ── Job Positions ─────────────────────────────────────────────────────────────

const SRC_JOB_POSITIONS = [
  { name: 'Software Engineer',           description: 'Develop and maintain software solutions.',                               requirements: 'Proficiency in PHP, JavaScript, and Python.'              },
  { name: 'HR Manager',                  description: 'Manage HR activities including recruitment and employee relations.',     requirements: 'Experience in HR management and interpersonal skills.'    },
  { name: 'Marketing Specialist',        description: 'Plan and execute marketing campaigns.',                                  requirements: 'Knowledge of digital marketing and analytics tools.'      },
  { name: 'Sales Manager',               description: 'Oversee the sales team and develop revenue strategies.',                requirements: 'Strong background in sales and leadership.'              },
  { name: 'Product Manager',             description: 'Oversee product development and lifecycle.',                            requirements: 'Experience in product management and market research.'    },
  { name: 'UX/UI Designer',              description: 'Design intuitive user interfaces and improve UX.',                      requirements: 'Experience with Figma, Sketch, or Adobe XD.'            },
  { name: 'Customer Support Specialist', description: 'Provide customer assistance and resolve issues.',                       requirements: 'Excellent communication skills and patience.'            },
  { name: 'Data Scientist',              description: 'Analyze data and build predictive models.',                             requirements: 'Knowledge of ML, Python, and data visualisation tools.'  },
  { name: 'Finance Analyst',             description: 'Analyze financial data and provide insights.',                          requirements: 'Strong analytical skills and knowledge of finance.'      },
  { name: 'Legal Advisor',               description: 'Provide legal guidance and ensure compliance.',                         requirements: 'Law degree and experience in corporate law.'             },
  { name: 'Head of Business and AI',     description: 'Lead business strategy and AI integration.',                           requirements: 'Extensive leadership and AI experience.'                },
  { name: 'CEO',                         description: 'Lead the organisation and oversee all operations.',                    requirements: 'Proven leadership and strategic vision.'                },
  { name: 'CFO',                         description: 'Manage financial planning and risk management.',                       requirements: 'CPA or equivalent and financial management experience.'  },
];

// ── Work Locations ────────────────────────────────────────────────────────────

const SRC_WORK_LOCATIONS = [
  { name: 'Home',                     type: 'home',   address: null                              },
  { name: 'Building 1, Second Floor', type: 'office', address: null                              },
  { name: 'Other',                    type: 'other',  address: null                              },
  { name: 'GKK Office',               type: 'office', address: '17 KG 37 Avenue, Kigali, Rwanda' },
];

// ── Projects ──────────────────────────────────────────────────────────────────

const SRC_PROJECTS = [
  { src_id:  1, name: 'KWIK DRIVE',                                          description: 'Connect drivers with their passengers.'                                                },
  { src_id:  2, name: 'Kwik Senda',                                          description: 'Peer-to-peer international package delivery — connects senders with travelers.'       },
  { src_id:  3, name: 'Kwik Ride Dashboard',                                 description: 'Dashboard to control and visualise all Kwik Ride operations.'                       },
  { src_id:  4, name: 'Rwanda Trauma Registry',                              description: 'Tracking trauma cases across Rwanda.'                                               },
  { src_id:  5, name: 'Kwik Ride Mobile',                                    description: ''                                                                                   },
  { src_id:  6, name: 'Kwik Ride',                                           description: 'Kwik Ride platform.'                                                               },
  { src_id:  7, name: 'Kwik Ride Mobile v2',                                 description: ''                                                                                   },
  { src_id:  8, name: 'SfH-EMR',                                             description: 'EMR System Enhancement Project to digitise healthcare workflows.'                   },
  { src_id:  9, name: 'NHIC Public Portal',                                  description: 'Public-facing portal for the National Health Insurance Commission.'                 },
  { src_id: 10, name: 'Centralized Teleradiology Platform (DICOM)',          description: "Rwanda's centralised teleradiology platform for DICOM image management."            },
  { src_id: 11, name: 'Mosquito DB (VectorScope)',                           description: "Rwanda's nationally owned vector-surveillance platform."                            },
  { src_id: 12, name: 'Rwanda Health Insurance Portal (RHIP)',               description: 'National Insurance Operations Hub.'                                                },
  { src_id: 13, name: 'National Hygiene & Inspection Portal (NHIP)',         description: 'Hygiene and food-safety inspection management platform.'                           },
  { src_id: 14, name: 'HEC Foreign Qualification Equivalency MIS',          description: 'Platform for processing foreign qualification equivalency applications.'             },
  { src_id: 15, name: 'Rwanda Health Council Connect (RHCC)',                description: 'National Healthcare Professional Credentialing platform.'                          },
  { src_id: 16, name: 'Real-Time Data Ingestion — NHIC Data Warehouse',     description: 'Pipeline for real-time data ingestion into the NHIC data warehouse.'               },
  { src_id: 17, name: 'New Infrastructure Documentation & Migration Prep',   description: 'Documentation and preparation for RSA migration strategy.'                         },
  { src_id: 18, name: 'Data Governance Measures — Implementation & Monitor', description: 'Built-in governance at the infrastructure layer.'                                  },
  { src_id: 19, name: 'Monthly User Access Audit & Monitoring Dashboard',    description: 'Proactive security and performance oversight reporting.'                           },
  { src_id: 20, name: 'Platform Tooling Expansion for Data Scientists',      description: 'Secure, centrally managed analytics platform for data scientists and analysts.'    },
  { src_id: 21, name: 'GKK Fellowship Program',                              description: 'GKK Fellowship Program for talent development.'                                   },
  { src_id: 22, name: 'HEC Accreditation',                                   description: 'Helping HEC with accreditation processes.'                                       },
  { src_id: 23, name: 'e-Buzima',                                            description: 'Electronic health platform.'                                                      },
  { src_id: 24, name: 'Kwik Social',                                         description: 'Social platform by KwikKoders.'                                                   },
];

const COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308',
  '#22c55e','#14b8a6','#06b6d4','#3b82f6','#a855f7','#10b981',
  '#f59e0b','#84cc16','#0ea5e9','#d946ef','#fb923c','#34d399',
  '#60a5fa','#c084fc','#f472b6','#4ade80','#38bdf8','#a78bfa',
];

// state → GKK status
const STATE_MAP = { in_progress: 'in_progress', approved: 'done', done: 'done' };

const SRC_TASKS = [
  { src_id:  1, title: 'Hosting Via Appstore & Playstore',                       description: 'Designing the class diagram and the ERD.',        state: 'in_progress', project_src_id:  2, due: '2026-04-30' },
  { src_id:  2, title: 'Highlighting the need of solving the problem',            description: '',                                                state: 'in_progress', project_src_id:  2, due: '2026-04-29' },
  { src_id:  3, title: 'Updating users information',                              description: 'Updating people information.',                    state: 'in_progress', project_src_id:  2, due: '2026-04-16' },
  { src_id:  4, title: 'Telerade',                                                description: 'This task must be done in three days.',           state: 'in_progress', project_src_id:  2, due: '2026-04-26' },
  { src_id:  5, title: 'HEC-MIS',                                                 description: 'This must be done in three weeks.',               state: 'in_progress', project_src_id: null, due: null       },
  { src_id:  6, title: 'Analysing the problem statement',                         description: '',                                                state: 'in_progress', project_src_id:  4, due: '2026-05-30' },
  { src_id:  7, title: 'Demo task',                                               description: '',                                                state: 'in_progress', project_src_id:  4, due: null        },
  { src_id:  8, title: 'Demo',                                                    description: '',                                                state: 'in_progress', project_src_id: null, due: null       },
  { src_id:  9, title: 'Demo task on this project',                               description: '',                                                state: 'approved',    project_src_id:  4, due: null        },
  { src_id: 10, title: 'Testing this now',                                        description: '',                                                state: 'in_progress', project_src_id:  4, due: null        },
  { src_id: 11, title: 'Cloning the current version',                             description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 12, title: 'Healthcare (Main Workspace)',                              description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 13, title: 'HIV Module',                                               description: 'All 12 doctypes rebuilt field-accurate. Deployed and verified end-to-end.', state: 'in_progress', project_src_id: 23, due: null },
  { src_id: 14, title: 'Healthcare (Main Workspace) — sub',                       description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 15, title: 'Mental Health Module',                                     description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 16, title: 'NCD (Non-Communicable Disease) Module',                   description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 17, title: 'IMCI Module',                                              description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 18, title: 'Tuberculosis (TB) Module',                                description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 19, title: 'Nurse Desk Workspace',                                     description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 20, title: 'Doctor Desk Workspace',                                    description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 21, title: 'Reports & Aggregate Reports Pages',                        description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 22, title: 'Deep Testing & Bug-Fix Pass',                             description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 23, title: 'Other Workspaces (Billing, Pharmacy, Laboratory, Radiology)', description: '',                                            state: 'in_progress', project_src_id: 23, due: null        },
  { src_id: 24, title: 'Designing new UI',                                         description: '',                                                state: 'done',        project_src_id: 23, due: '2026-08-10' },
  { src_id: 25, title: 'Cloning and installing the current version',               description: '',                                                state: 'in_progress', project_src_id: 24, due: null        },
  { src_id: 26, title: 'Test',                                                     description: '',                                                state: 'in_progress', project_src_id: 23, due: null        },
];

const SRC_MILESTONES = [
  { project_src_id: 2, name: 'Payment completion', deadline: null, is_done: true  },
  { project_src_id: 2, name: 'Testing & Hosting',  deadline: null, is_done: false },
  { project_src_id: 4, name: 'Feasibility study',  deadline: null, is_done: true  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

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
    // ── 1. COMPANY ───────────────────────────────────────────────────────────
    console.log('\n── 1. Company');
    let company = await db('companies').where({ slug: COMPANY.slug }).first();
    if (company) {
      console.log(`  EXIST  ${company.name} (${company.id})`);
    } else {
      const id = uuid();
      await db('companies').insert({ id, name: COMPANY.name, slug: COMPANY.slug, plan: COMPANY.plan });
      company = await db('companies').where({ id }).first();
      console.log(`  INSERT ${company.name} (${company.id})`);
    }
    const companyId = company.id;

    // ── 2. DEPARTMENTS (no manager_id yet) ───────────────────────────────────
    console.log('\n── 2. Departments');
    const deptIdMap = new Map(); // src_id → UUID
    for (const d of SRC_DEPARTMENTS) {
      let row = await db('departments').where({ company_id: companyId, name: d.name }).first();
      if (row) {
        deptIdMap.set(d.src_id, row.id);
        console.log(`  EXIST  ${d.name}`);
      } else {
        const id = uuid();
        await db('departments').insert({ id, company_id: companyId, name: d.name });
        deptIdMap.set(d.src_id, id);
        console.log(`  INSERT ${d.name}`);
      }
    }

    // ── 3. USERS ─────────────────────────────────────────────────────────────
    console.log('\n── 3. Users');
    const userIdMap = new Map(); // src_user_id → UUID
    for (const u of SRC_USERS) {
      let row = await db('users').where({ email: u.email }).first();
      if (row) {
        userIdMap.set(u.src_user_id, row.id);
        console.log(`  EXIST  ${u.first_name} ${u.last_name} <${u.email}>`);
      } else {
        const id = uuid();
        const deptId = u.dept_src_id ? deptIdMap.get(u.dept_src_id) || null : null;
        await db('users').insert({
          id,
          company_id:    companyId,
          department_id: deptId,
          email:         u.email,
          password_hash: u.pw,
          first_name:    u.first_name,
          last_name:     u.last_name,
          role:          u.role,
          job_title:     u.job_title,
          phone:         u.phone || null,
          is_active:     true,
        });
        userIdMap.set(u.src_user_id, id);
        console.log(`  INSERT [${u.role}] ${u.first_name} ${u.last_name}`);
      }
    }

    // ── 4. DEPARTMENT MANAGERS ────────────────────────────────────────────────
    console.log('\n── 4. Department managers');
    for (const u of SRC_USERS) {
      if (!u.manager_dept_src_id) continue;
      const deptId   = deptIdMap.get(u.manager_dept_src_id);
      const managerId = userIdMap.get(u.src_user_id);
      if (!deptId || !managerId) continue;
      await db('departments').where({ id: deptId }).update({ manager_id: managerId });
      console.log(`  SET    manager of dept ${u.manager_dept_src_id} → ${u.first_name} ${u.last_name}`);
    }

    // ── 5. JOB POSITIONS ─────────────────────────────────────────────────────
    console.log('\n── 5. Job positions');
    for (const jp of SRC_JOB_POSITIONS) {
      const exists = await db('job_positions').where({ company_id: companyId, name: jp.name }).first();
      if (exists) { console.log(`  EXIST  ${jp.name}`); continue; }
      await db('job_positions').insert({ id: uuid(), company_id: companyId, name: jp.name, description: jp.description, requirements: jp.requirements });
      console.log(`  INSERT ${jp.name}`);
    }

    // ── 6. WORK LOCATIONS ────────────────────────────────────────────────────
    console.log('\n── 6. Work locations');
    for (const wl of SRC_WORK_LOCATIONS) {
      const exists = await db('work_locations').where({ company_id: companyId, name: wl.name }).first();
      if (exists) { console.log(`  EXIST  ${wl.name}`); continue; }
      await db('work_locations').insert({ id: uuid(), company_id: companyId, name: wl.name, type: wl.type, address: wl.address || null });
      console.log(`  INSERT ${wl.name}`);
    }

    // ── 7. PROJECTS ──────────────────────────────────────────────────────────
    console.log('\n── 7. Projects');
    const projIdMap = new Map(); // src_id → UUID
    // Use Josue (CEO / admin) as owner
    const ownerId = userIdMap.get(29); // josue@kwikkoders.com

    for (let i = 0; i < SRC_PROJECTS.length; i++) {
      const p = SRC_PROJECTS[i];
      let row = await db('projects').where({ company_id: companyId, name: p.name }).first();
      if (row) {
        projIdMap.set(p.src_id, row.id);
        console.log(`  EXIST  ${p.name}`);
        continue;
      }
      const id = uuid();
      await db('projects').insert({
        id, company_id: companyId, owner_id: ownerId,
        name: p.name, description: p.description || null,
        status: 'active', color: COLORS[i % COLORS.length],
      });
      await db('project_members').insert({ id: uuid(), project_id: id, user_id: ownerId, role: 'owner' });
      projIdMap.set(p.src_id, id);
      console.log(`  INSERT ${p.name}`);
    }

    // ── 8. ISSUES (tasks) ────────────────────────────────────────────────────
    console.log('\n── 8. Issues');
    let pos = 1;
    for (const t of SRC_TASKS) {
      if (!t.project_src_id) {
        console.log(`  SKIP   "${t.title}" — no project`);
        continue;
      }
      const projectId = projIdMap.get(t.project_src_id);
      if (!projectId) {
        console.log(`  SKIP   "${t.title}" — project ${t.project_src_id} not mapped`);
        continue;
      }
      const exists = await db('issues').where({ project_id: projectId, title: t.title }).first();
      if (exists) { console.log(`  EXIST  "${t.title}"`); continue; }
      await db('issues').insert({
        id:          uuid(),
        project_id:  projectId,
        reporter_id: ownerId,
        title:       t.title,
        description: t.description || null,
        type:        'task',
        priority:    'medium',
        status:      STATE_MAP[t.state] || 'in_progress',
        due_date:    t.due || null,
        position:    pos++,
      });
      console.log(`  INSERT [${STATE_MAP[t.state] || 'in_progress'}] "${t.title}"`);
    }

    // ── 9. MILESTONES ────────────────────────────────────────────────────────
    console.log('\n── 9. Milestones');
    for (const m of SRC_MILESTONES) {
      const projectId = projIdMap.get(m.project_src_id);
      if (!projectId) { console.log(`  SKIP   "${m.name}" — project not mapped`); continue; }
      const exists = await db('milestones').where({ project_id: projectId, name: m.name }).first();
      if (exists) { console.log(`  EXIST  "${m.name}"`); continue; }
      await db('milestones').insert({ id: uuid(), project_id: projectId, name: m.name, is_done: m.is_done ? 1 : 0 });
      console.log(`  INSERT "${m.name}" (done=${m.is_done})`);
    }

    console.log('\n✓ Import complete.');
    console.log(`\nAdmin login: josue@kwikkoders.com`);
    console.log(`Password:    same as kwikerpnw system\n`);

  } catch (err) {
    console.error('\nImport failed:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.error('Missing table — did migration 010 run? Restart the API first to apply migrations.');
    }
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
