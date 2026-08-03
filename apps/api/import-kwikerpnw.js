'use strict';
/**
 * Import script: kwikerpnw.sql → GKK ERP
 *
 * Imports:
 *   employees_departments   → departments
 *   employees_job_positions → job_positions  (requires migration 010)
 *   employees_work_locations → work_locations (requires migration 010)
 *   projects_projects       → projects
 *   projects_tasks          → issues
 *   projects_milestones     → milestones     (requires migration 010)
 *
 * Usage:
 *   node apps/api/import-kwikerpnw.js
 *
 * Prerequisites:
 *   - Run migrations first: the app will auto-run them on next start, or
 *     start the API once so migration 010 is applied.
 *   - At least one company and one admin user must exist (from seeds).
 */

const path = require('path');
const fs = require('fs');
const knexLib = require('knex');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { v4: uuid } = require('uuid');

// ── Source data extracted from kwikerpnw.sql ─────────────────────────────────

const SRC_DEPARTMENTS = [
  { src_id: 22, name: 'Administration',       color: '#4e0554', parent_src_id: null },
  { src_id: 28, name: 'Marketing & Sales',    color: '#590819', parent_src_id: 22   },
  { src_id: 29, name: 'R&D Department',       color: '#638a61', parent_src_id: 22   },
  { src_id: 30, name: 'Finance & Accounting', color: '#2081ab', parent_src_id: 22   },
  { src_id: 33, name: 'HR Department',        color: '#5dd7e8', parent_src_id: null },
  { src_id: 34, name: 'Business Development', color: null,      parent_src_id: null },
  { src_id: 35, name: 'Management',           color: null,      parent_src_id: 22   },
];

const SRC_JOB_POSITIONS = [
  { src_id: 31, name: 'Software Engineer',            description: 'Develop and maintain software solutions.',                                  requirements: 'Proficiency in programming languages like PHP, JavaScript, and Python.' },
  { src_id: 32, name: 'HR Manager',                   description: 'Manage HR activities, including recruitment and employee relations.',        requirements: 'Experience in HR management and excellent interpersonal skills.'        },
  { src_id: 33, name: 'Marketing Specialist',         description: 'Plan and execute marketing campaigns.',                                      requirements: 'Knowledge of digital marketing, content creation, and analytics tools.'  },
  { src_id: 34, name: 'Sales Manager',                description: 'Oversee the sales team and develop strategies to increase revenue.',         requirements: 'Strong background in sales and leadership experience.'                 },
  { src_id: 35, name: 'Product Manager',              description: 'Oversee the development and lifecycle of products from start to finish.',    requirements: 'Experience in product management and market research.'                 },
  { src_id: 36, name: 'UX/UI Designer',               description: 'Design intuitive user interfaces and improve user experience.',              requirements: 'Experience with design tools like Sketch, Figma, Adobe XD.'           },
  { src_id: 37, name: 'Customer Support Specialist',  description: 'Provide assistance to customers and solve their issues.',                    requirements: 'Excellent communication skills and patience.'                         },
  { src_id: 38, name: 'Data Scientist',               description: 'Analyze data and build predictive models.',                                  requirements: 'Knowledge of machine learning, Python, and data visualization tools.'  },
  { src_id: 39, name: 'Finance Analyst',              description: 'Analyze financial data and provide insights.',                               requirements: 'Strong analytical skills and knowledge of financial systems.'          },
  { src_id: 40, name: 'Legal Advisor',                description: 'Provide legal guidance and ensure compliance.',                              requirements: 'Law degree and experience in corporate law.'                          },
  { src_id: 41, name: 'Head of Business and AI',      description: 'Lead business strategy and AI integration initiatives.',                     requirements: 'Extensive experience in business leadership and AI technologies.'      },
  { src_id: 42, name: 'CEO',                          description: 'Lead the organization and oversee all operations.',                          requirements: 'Proven leadership experience and strategic vision.'                   },
  { src_id: 43, name: 'CFO',                          description: 'Manage financial planning and risk management.',                              requirements: 'CPA or equivalent and experience in financial management.'             },
];

const SRC_WORK_LOCATIONS = [
  { src_id: 10, name: 'Home',                     type: 'home',   address: null                         },
  { src_id: 11, name: 'Building 1, Second Floor', type: 'office', address: null                         },
  { src_id: 12, name: 'Other',                    type: 'other',  address: null                         },
  { src_id: 13, name: 'GKK Office',               type: 'office', address: '17 KG 37 Avenue, Kigali, Rwanda' },
];

const SRC_PROJECTS = [
  { src_id: 1,  name: 'KWIK DRIVE',                                         description: 'Connect drivers with their passengers.'                                          },
  { src_id: 2,  name: 'Kwik Senda',                                         description: 'Peer-to-peer international package delivery platform connecting senders with travelers.' },
  { src_id: 3,  name: 'Kwik Ride Dashboard',                                description: 'Dashboard to control and visualise all the operations of Kwik Ride.'             },
  { src_id: 4,  name: 'Rwanda Trauma Registry',                             description: 'Tracking trauma cases across Rwanda.'                                            },
  { src_id: 5,  name: 'Kwik Ride Mobile',                                   description: ''                                                                                },
  { src_id: 6,  name: 'Kwik Ride',                                          description: 'Last Updated: April 28, 2026. Status: Active. Owner: Kwik Ride Team.'            },
  { src_id: 7,  name: 'Kwik Ride Mobile (v2)',                              description: ''                                                                                },
  { src_id: 8,  name: 'SfH-EMR',                                            description: 'EMR System Enhancement Project to digitize healthcare workflows.'                 },
  { src_id: 9,  name: 'NHIC Public Portal',                                 description: 'Public-facing portal for the National Health Insurance Commission.'               },
  { src_id: 10, name: 'Centralized Teleradiology Platform (DICOM)',         description: "Rwanda's centralised teleradiology platform for DICOM image management."         },
  { src_id: 11, name: 'Mosquito DB (VectorScope)',                          description: "Rwanda's nationally owned platform for mosquito/vector surveillance."             },
  { src_id: 12, name: 'Rwanda Health Insurance Portal (RHIP)',              description: 'National Insurance Operations Hub for RHIP.'                                     },
  { src_id: 13, name: 'National Hygiene & Inspection Portal (NHIP)',        description: 'Hygiene and food-safety inspection management platform.'                          },
  { src_id: 14, name: 'HEC Foreign Qualification Equivalency MIS',         description: 'Platform for processing foreign qualification equivalency applications.'          },
  { src_id: 15, name: 'Rwanda Health Council Connect (RHCC)',               description: 'National Healthcare Professional Credentialing platform.'                        },
  { src_id: 16, name: 'Real-Time Data Ingestion — NHIC Data Warehouse',    description: 'Pipeline for real-time data ingestion into the NHIC data warehouse.'             },
  { src_id: 17, name: 'New Infrastructure Documentation & Migration Prep',  description: 'Documentation and preparation for RSA migration strategy.'                       },
  { src_id: 18, name: 'Data Governance Measures — Implementation & Monitor',description: 'Built-in governance at the infrastructure layer.'                                },
  { src_id: 19, name: 'Monthly User Access Audit & Monitoring Dashboard',   description: 'Proactive security and performance oversight reporting.'                         },
  { src_id: 20, name: 'Platform Tooling Expansion for Data Scientists',     description: 'Secure, centrally managed analytics platform for data scientists and analysts.'  },
  { src_id: 21, name: 'GKK Fellowship Program',                             description: 'GKK Fellowship Program for talent development.'                                  },
  { src_id: 22, name: 'HEC Accreditation',                                  description: 'Helping HEC with accreditation processes.'                                      },
  { src_id: 23, name: 'e-Buzima',                                           description: ''                                                                                },
  { src_id: 24, name: 'Kwik Social',                                        description: ''                                                                                },
];

// state → GKK status: in_progress → in_progress, approved/done → done
const STATE_MAP = { in_progress: 'in_progress', approved: 'done', done: 'done' };

const SRC_TASKS = [
  { src_id: 1,  title: 'Hosting Via Appstore & Playstore',                    description: 'Designing the class diagram and the ERD.',         state: 'in_progress', priority: 0, project_src_id: 2,  due: '2026-04-30' },
  { src_id: 2,  title: 'Highlighting the need of solving the problem',         description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 2,  due: '2026-04-29' },
  { src_id: 3,  title: 'Updating users information',                           description: 'Updating people information.',                     state: 'in_progress', priority: 0, project_src_id: 2,  due: '2026-04-16' },
  { src_id: 4,  title: 'Telerade',                                             description: 'This task must be done in three days.',            state: 'in_progress', priority: 0, project_src_id: 2,  due: '2026-04-26' },
  { src_id: 5,  title: 'HEC-MIS',                                              description: 'This must be done in three weeks.',                state: 'in_progress', priority: 0, project_src_id: null, due: null        },
  { src_id: 6,  title: 'Analysing the problem statement',                      description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 4,  due: '2026-05-30' },
  { src_id: 7,  title: 'Demo task',                                            description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 4,  due: null        },
  { src_id: 8,  title: 'Demo',                                                 description: '',                                                 state: 'in_progress', priority: 0, project_src_id: null, due: null        },
  { src_id: 9,  title: 'Demo task on this project',                            description: '',                                                 state: 'approved',    priority: 0, project_src_id: 4,  due: null        },
  { src_id: 10, title: 'Testing this now',                                     description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 4,  due: null        },
  { src_id: 11, title: 'Cloning the current version',                          description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 12, title: 'Healthcare (Main Workspace)',                           description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 13, title: 'HIV Module',                                            description: 'All 12 doctypes rebuilt field-accurate from production screenshots. Deployed and verified end-to-end.', state: 'in_progress', priority: 0, project_src_id: 23, due: null },
  { src_id: 14, title: 'Healthcare (Main Workspace) — sub',                    description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 15, title: 'Mental Health Module',                                  description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 16, title: 'NCD (Non-Communicable Disease) Module',                description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 17, title: 'IMCI Module',                                           description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 18, title: 'Tuberculosis (TB) Module',                             description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 19, title: 'Nurse Desk Workspace',                                  description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 20, title: 'Doctor Desk Workspace',                                 description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 21, title: 'Reports & Aggregate Reports Pages',                    description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 22, title: 'Deep Testing & Bug-Fix Pass',                          description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 23, title: 'Other Workspaces (Billing, Pharmacy, Laboratory, Radiology)', description: '',                                          state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
  { src_id: 24, title: 'Designing new UI',                                      description: '',                                                 state: 'done',        priority: 0, project_src_id: 23, due: '2026-08-10' },
  { src_id: 25, title: 'Cloning and installing the current version',            description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 24, due: null        },
  { src_id: 26, title: 'Test',                                                  description: '',                                                 state: 'in_progress', priority: 0, project_src_id: 23, due: null        },
];

const SRC_MILESTONES = [
  { src_id: 2, project_src_id: 2, name: 'Payment completion',    deadline: null,         is_done: true  },
  { src_id: 3, project_src_id: 2, name: 'Testing & Hosting',     deadline: null,         is_done: false },
  { src_id: 4, project_src_id: 4, name: 'Feasibility study',     deadline: null,         is_done: true  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

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
    // Resolve admin user + company
    const admin = await db('users').where({ role: 'admin' }).whereNull('deleted_at').first();
    if (!admin) throw new Error('No admin user found. Run seeds first.');
    const companyId = admin.company_id;
    const adminId   = admin.id;
    console.log(`Using company ${companyId} / admin ${admin.first_name} ${admin.last_name}`);

    // ── 1. DEPARTMENTS ─────────────────────────────────────────────────────
    console.log('\n── Importing departments…');
    const deptIdMap = new Map(); // src_id → new UUID

    // First pass: create all departments (without parent linkage — GKK schema has no parent_id)
    for (const d of SRC_DEPARTMENTS) {
      const exists = await db('departments').where({ company_id: companyId, name: d.name }).first();
      if (exists) {
        deptIdMap.set(d.src_id, exists.id);
        console.log(`  SKIP  ${d.name} (already exists)`);
        continue;
      }
      const id = uuid();
      await db('departments').insert({ id, company_id: companyId, name: d.name });
      deptIdMap.set(d.src_id, id);
      console.log(`  INSERT ${d.name}`);
    }

    // ── 2. JOB POSITIONS ───────────────────────────────────────────────────
    console.log('\n── Importing job positions…');
    for (const jp of SRC_JOB_POSITIONS) {
      const exists = await db('job_positions').where({ company_id: companyId, name: jp.name }).first();
      if (exists) { console.log(`  SKIP  ${jp.name}`); continue; }
      await db('job_positions').insert({
        id:           uuid(),
        company_id:   companyId,
        name:         jp.name,
        description:  jp.description || null,
        requirements: jp.requirements || null,
      });
      console.log(`  INSERT ${jp.name}`);
    }

    // ── 3. WORK LOCATIONS ──────────────────────────────────────────────────
    console.log('\n── Importing work locations…');
    for (const wl of SRC_WORK_LOCATIONS) {
      const exists = await db('work_locations').where({ company_id: companyId, name: wl.name }).first();
      if (exists) { console.log(`  SKIP  ${wl.name}`); continue; }
      await db('work_locations').insert({
        id:         uuid(),
        company_id: companyId,
        name:       wl.name,
        type:       wl.type,
        address:    wl.address || null,
      });
      console.log(`  INSERT ${wl.name}`);
    }

    // ── 4. PROJECTS ────────────────────────────────────────────────────────
    console.log('\n── Importing projects…');
    const projIdMap = new Map(); // src_id → new UUID

    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#f43f5e','#f97316','#eab308',
                    '#22c55e','#14b8a6','#06b6d4','#3b82f6','#a855f7','#10b981'];

    for (let i = 0; i < SRC_PROJECTS.length; i++) {
      const p = SRC_PROJECTS[i];
      const exists = await db('projects').where({ company_id: companyId, name: p.name }).first();
      if (exists) {
        projIdMap.set(p.src_id, exists.id);
        console.log(`  SKIP  ${p.name}`);
        continue;
      }
      const id = uuid();
      await db('projects').insert({
        id,
        company_id:  companyId,
        owner_id:    adminId,
        name:        p.name,
        description: p.description || null,
        status:      'active',
        color:       COLORS[i % COLORS.length],
        icon:        null,
      });
      // Add admin as project owner-member
      await db('project_members').insert({ id: uuid(), project_id: id, user_id: adminId, role: 'owner' });
      projIdMap.set(p.src_id, id);
      console.log(`  INSERT ${p.name}`);
    }

    // ── 5. ISSUES (tasks) ─────────────────────────────────────────────────
    console.log('\n── Importing issues (tasks)…');
    let position = 1;
    for (const t of SRC_TASKS) {
      if (!t.project_src_id) {
        console.log(`  SKIP  [${t.src_id}] "${t.title}" (no project)`);
        continue;
      }
      const projectId = projIdMap.get(t.project_src_id);
      if (!projectId) {
        console.log(`  SKIP  [${t.src_id}] "${t.title}" (project ${t.project_src_id} not found)`);
        continue;
      }
      const exists = await db('issues').where({ project_id: projectId, title: t.title }).first();
      if (exists) {
        console.log(`  SKIP  "${t.title}"`);
        continue;
      }
      const status = STATE_MAP[t.state] || 'in_progress';
      await db('issues').insert({
        id:          uuid(),
        project_id:  projectId,
        reporter_id: adminId,
        title:       t.title,
        description: t.description || null,
        type:        'task',
        priority:    t.priority === 1 ? 'high' : 'medium',
        status,
        due_date:    t.due || null,
        position:    position++,
      });
      console.log(`  INSERT [${status}] "${t.title}"`);
    }

    // ── 6. MILESTONES ──────────────────────────────────────────────────────
    console.log('\n── Importing milestones…');
    for (const m of SRC_MILESTONES) {
      const projectId = projIdMap.get(m.project_src_id);
      if (!projectId) {
        console.log(`  SKIP  "${m.name}" (project ${m.project_src_id} not found)`);
        continue;
      }
      const exists = await db('milestones').where({ project_id: projectId, name: m.name }).first();
      if (exists) { console.log(`  SKIP  ${m.name}`); continue; }
      await db('milestones').insert({
        id:          uuid(),
        project_id:  projectId,
        name:        m.name,
        description: null,
        deadline:    m.deadline || null,
        is_done:     m.is_done ? 1 : 0,
      });
      console.log(`  INSERT "${m.name}" (done=${m.is_done})`);
    }

    console.log('\n✓ Import complete.');
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

main();
