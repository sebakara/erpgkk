import type { Knex } from 'knex';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

/* ── helpers ── */
const today = () => new Date().toISOString().split('T')[0];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const hash = (pw: string) => bcrypt.hash(pw, 10);

export async function seed(knex: Knex): Promise<void> {
  /* ── wipe in FK-safe order ── */
  await knex('employee_leave_packages').del();
  await knex('leave_package_types').del();
  await knex('leave_packages').del();
  await knex('performance_reviews').del();
  await knex('audit_logs').del().catch(() => {});
  await knex('notifications').del();
  await knex('announcements').del();
  await knex('leave_requests').del();
  await knex('comments').del();
  await knex('issues').del();
  await knex('sprints').del();
  await knex('project_members').del();
  await knex('projects').del();
  await knex('users').del();
  await knex('departments').del();
  await knex('companies').del();

  /* ══════════════════════════════════════════════════
     COMPANY
  ══════════════════════════════════════════════════ */
  const companyId = uuid();
  await knex('companies').insert({
    id: companyId,
    name: 'GKK Technologies',
    slug: 'gkk',
    plan: 'pro',
  });

  /* ══════════════════════════════════════════════════
     DEPARTMENTS (IDs kept so we can set heads later)
  ══════════════════════════════════════════════════ */
  const deptEngId     = uuid();
  const deptProductId = uuid();
  const deptHrId      = uuid();
  const deptOpsId     = uuid();
  const deptMgmtId    = uuid();

  await knex('departments').insert([
    { id: deptEngId,     company_id: companyId, name: 'Engineering'      },
    { id: deptProductId, company_id: companyId, name: 'Product'          },
    { id: deptHrId,      company_id: companyId, name: 'Human Resources'  },
    { id: deptOpsId,     company_id: companyId, name: 'Operations'       },
    { id: deptMgmtId,    company_id: companyId, name: 'Management'       },
  ]);

  /* ══════════════════════════════════════════════════
     MANAGEMENT (4 people)
  ══════════════════════════════════════════════════ */
  const pw = await hash('Admin@1234');

  const adminId   = uuid();  // CTO → Engineering head
  const ceoId     = uuid();  // CEO → Operations head
  const hrMgrId   = uuid();  // HR Manager → HR head
  const productMgrId = uuid(); // Product Manager → Product head

  await knex('users').insert([
    {
      id: adminId,
      company_id: companyId,
      department_id: deptEngId,
      email: 'admin@gkk.com',
      password_hash: pw,
      first_name: 'Alex',
      last_name: 'Morgan',
      role: 'admin',
      job_title: 'Chief Technology Officer',
      is_active: true,
    },
    {
      id: ceoId,
      company_id: companyId,
      department_id: deptOpsId,
      email: 'ceo@gkk.com',
      password_hash: pw,
      first_name: 'Jordan',
      last_name: 'Blake',
      role: 'admin',
      job_title: 'Chief Executive Officer',
      is_active: true,
    },
    {
      id: hrMgrId,
      company_id: companyId,
      department_id: deptMgmtId,
      email: 'hr@gkk.com',
      password_hash: pw,
      first_name: 'Priya',
      last_name: 'Sharma',
      role: 'manager',
      job_title: 'HR Manager',
      is_active: true,
    },
    {
      id: productMgrId,
      company_id: companyId,
      department_id: deptMgmtId,
      email: 'product@gkk.com',
      password_hash: pw,
      first_name: 'Sam',
      last_name: 'Rivera',
      role: 'manager',
      job_title: 'Product Manager',
      is_active: true,
    },
  ]);

  /* ══════════════════════════════════════════════════
     DEVELOPERS (10 people)
  ══════════════════════════════════════════════════ */
  const devPw = await hash('Dev@1234');

  const developers: { id: string; first_name: string; last_name: string; email: string; job_title: string }[] = [
    { id: uuid(), first_name: 'Liam',    last_name: 'Chen',       email: 'liam.chen@gkk.com',       job_title: 'Senior Frontend Developer'  },
    { id: uuid(), first_name: 'Aisha',   last_name: 'Diallo',     email: 'aisha.diallo@gkk.com',     job_title: 'Backend Developer'           },
    { id: uuid(), first_name: 'Carlos',  last_name: 'Mendoza',    email: 'carlos.mendoza@gkk.com',   job_title: 'Full-Stack Developer'        },
    { id: uuid(), first_name: 'Yuki',    last_name: 'Tanaka',     email: 'yuki.tanaka@gkk.com',      job_title: 'Mobile Developer'            },
    { id: uuid(), first_name: 'Fatima',  last_name: 'Al-Rashid',  email: 'fatima.alrashid@gkk.com', job_title: 'DevOps Engineer'             },
    { id: uuid(), first_name: 'Noah',    last_name: 'Williams',   email: 'noah.williams@gkk.com',    job_title: 'Backend Developer'           },
    { id: uuid(), first_name: 'Mei',     last_name: 'Lin',        email: 'mei.lin@gkk.com',          job_title: 'Frontend Developer'          },
    { id: uuid(), first_name: 'Kofi',    last_name: 'Asante',     email: 'kofi.asante@gkk.com',      job_title: 'QA Engineer'                 },
    { id: uuid(), first_name: 'Sofia',   last_name: 'Petrov',     email: 'sofia.petrov@gkk.com',     job_title: 'Full-Stack Developer'        },
    { id: uuid(), first_name: 'Marcus',  last_name: 'Thompson',   email: 'marcus.thompson@gkk.com',  job_title: 'Senior Backend Developer'   },
  ];

  await knex('users').insert(
    developers.map((d) => ({
      id: d.id,
      company_id: companyId,
      department_id: deptEngId,
      email: d.email,
      password_hash: devPw,
      first_name: d.first_name,
      last_name: d.last_name,
      role: 'employee',
      job_title: d.job_title,
      is_active: true,
    })),
  );

  /* ── Set department heads ── */
  await knex('departments').where({ id: deptEngId     }).update({ manager_id: adminId     });
  await knex('departments').where({ id: deptOpsId     }).update({ manager_id: ceoId       });
  await knex('departments').where({ id: deptHrId      }).update({ manager_id: hrMgrId     });
  await knex('departments').where({ id: deptProductId }).update({ manager_id: productMgrId });
  await knex('departments').where({ id: deptMgmtId    }).update({ manager_id: ceoId       });

  const allDevIds = developers.map((d) => d.id);
  const allMemberIds = [adminId, productMgrId, ...allDevIds];

  /* ══════════════════════════════════════════════════
     PROJECTS (5)
  ══════════════════════════════════════════════════ */
  const projects = [
    {
      id: uuid(), name: 'ERP Core Platform', icon: '🏗️', color: '#4f46e5',
      description: 'Main platform infrastructure — auth, multi-tenancy, permissions',
      owner: adminId,
    },
    {
      id: uuid(), name: 'Customer Portal', icon: '🌐', color: '#0891b2',
      description: 'Self-service portal for customers to manage orders and invoices',
      owner: productMgrId,
    },
    {
      id: uuid(), name: 'Mobile App', icon: '📱', color: '#16a34a',
      description: 'iOS & Android companion app for field employees',
      owner: adminId,
    },
    {
      id: uuid(), name: 'Analytics Dashboard', icon: '📊', color: '#d97706',
      description: 'Real-time KPI dashboards and business intelligence reports',
      owner: productMgrId,
    },
    {
      id: uuid(), name: 'DevOps & Infrastructure', icon: '⚙️', color: '#dc2626',
      description: 'CI/CD pipelines, Kubernetes clusters, monitoring and alerting',
      owner: adminId,
    },
  ];

  await knex('projects').insert(
    projects.map((p) => ({
      id: p.id,
      company_id: companyId,
      owner_id: p.owner,
      department_id: deptEngId,
      name: p.name,
      description: p.description,
      status: 'active',
      color: p.color,
      icon: p.icon,
    })),
  );

  /* Each project: owner + all devs as members */
  const memberRows: any[] = [];
  for (const p of projects) {
    memberRows.push({ id: uuid(), project_id: p.id, user_id: p.owner, role: 'owner' });
    const alreadyAdded = new Set<string>([p.owner]);
    for (const devId of allDevIds) {
      if (!alreadyAdded.has(devId)) {
        memberRows.push({ id: uuid(), project_id: p.id, user_id: devId, role: 'member' });
        alreadyAdded.add(devId);
      }
    }
    if (!alreadyAdded.has(productMgrId)) {
      memberRows.push({ id: uuid(), project_id: p.id, user_id: productMgrId, role: 'member' });
    }
  }
  await knex('project_members').insert(memberRows);

  /* ══════════════════════════════════════════════════
     SPRINTS + ISSUES per project
  ══════════════════════════════════════════════════ */

  const ISSUE_TEMPLATES: Record<string, { title: string; type: string; priority: string; label: string; points: number }[]> = {
    'ERP Core Platform': [
      { title: 'Design multi-tenant database schema',            type: 'story',  priority: 'high',   label: 'documentation', points: 8  },
      { title: 'Implement JWT refresh token rotation',           type: 'task',   priority: 'high',   label: 'enhancement',   points: 5  },
      { title: 'Role-based access control middleware',           type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'Fix session timeout on inactive tabs',           type: 'bug',    priority: 'urgent', label: 'bug',           points: 3  },
      { title: 'Add audit log for all write operations',         type: 'task',   priority: 'medium', label: 'enhancement',   points: 5  },
      { title: 'Company onboarding wizard UI',                   type: 'story',  priority: 'medium', label: 'enhancement',   points: 8  },
      { title: 'API rate limiting and throttling',               type: 'task',   priority: 'high',   label: 'enhancement',   points: 5  },
      { title: 'Email verification on registration',             type: 'task',   priority: 'medium', label: 'enhancement',   points: 3  },
      { title: 'Database connection pool tuning',                type: 'task',   priority: 'low',    label: 'enhancement',   points: 2  },
      { title: 'SSO integration with Google Workspace',          type: 'epic',   priority: 'medium', label: 'enhancement',   points: 13 },
    ],
    'Customer Portal': [
      { title: 'Customer login and registration flow',           type: 'story',  priority: 'high',   label: 'enhancement',   points: 5  },
      { title: 'Invoice list with search and filter',            type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'PDF invoice download',                           type: 'task',   priority: 'medium', label: 'enhancement',   points: 3  },
      { title: 'Order tracking status page',                     type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'Payment history table breaks on mobile',         type: 'bug',    priority: 'urgent', label: 'bug',           points: 2  },
      { title: 'Support ticket submission form',                 type: 'story',  priority: 'medium', label: 'enhancement',   points: 5  },
      { title: 'Password reset via email link',                  type: 'task',   priority: 'high',   label: 'enhancement',   points: 3  },
      { title: 'Profile settings page',                          type: 'task',   priority: 'low',    label: 'enhancement',   points: 2  },
      { title: 'Notification preferences center',                type: 'task',   priority: 'low',    label: 'enhancement',   points: 3  },
      { title: 'Dark mode support for portal',                   type: 'story',  priority: 'low',    label: 'enhancement',   points: 5  },
    ],
    'Mobile App': [
      { title: 'App architecture: React Native + Expo setup',   type: 'epic',   priority: 'high',   label: 'documentation', points: 13 },
      { title: 'Login screen with biometric auth',               type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'Push notification integration (FCM)',            type: 'task',   priority: 'high',   label: 'enhancement',   points: 5  },
      { title: 'Issue list and detail screens',                  type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'Offline mode with local cache',                  type: 'story',  priority: 'medium', label: 'enhancement',   points: 13 },
      { title: 'App crashes on Android 12 when opening docs',   type: 'bug',    priority: 'urgent', label: 'bug',           points: 3  },
      { title: 'Leave request form (mobile)',                    type: 'story',  priority: 'medium', label: 'enhancement',   points: 5  },
      { title: 'Team directory with search',                     type: 'task',   priority: 'medium', label: 'enhancement',   points: 3  },
      { title: 'App store listing assets and copy',              type: 'task',   priority: 'low',    label: 'documentation', points: 2  },
      { title: 'Beta TestFlight distribution setup',             type: 'task',   priority: 'medium', label: 'enhancement',   points: 3  },
    ],
    'Analytics Dashboard': [
      { title: 'KPI cards component library',                    type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'Real-time websocket data pipeline',              type: 'epic',   priority: 'high',   label: 'enhancement',   points: 13 },
      { title: 'Sprint velocity bar chart',                      type: 'task',   priority: 'medium', label: 'enhancement',   points: 5  },
      { title: 'Revenue vs expense line chart',                  type: 'story',  priority: 'high',   label: 'enhancement',   points: 8  },
      { title: 'Headcount breakdown pie chart',                  type: 'task',   priority: 'medium', label: 'enhancement',   points: 3  },
      { title: 'Date range picker for all charts',               type: 'task',   priority: 'medium', label: 'enhancement',   points: 3  },
      { title: 'CSV / PDF report export',                        type: 'story',  priority: 'medium', label: 'enhancement',   points: 5  },
      { title: 'Dashboard flickers on data refresh',             type: 'bug',    priority: 'high',   label: 'bug',           points: 2  },
      { title: 'Saved views / dashboard presets',                type: 'story',  priority: 'low',    label: 'enhancement',   points: 8  },
      { title: 'Scheduled email digest for managers',            type: 'task',   priority: 'low',    label: 'enhancement',   points: 5  },
    ],
    'DevOps & Infrastructure': [
      { title: 'Dockerize all microservices',                    type: 'epic',   priority: 'high',   label: 'enhancement',   points: 13 },
      { title: 'GitHub Actions CI pipeline',                     type: 'task',   priority: 'high',   label: 'enhancement',   points: 5  },
      { title: 'Kubernetes cluster setup (GKE)',                 type: 'story',  priority: 'high',   label: 'enhancement',   points: 13 },
      { title: 'Automated DB backups to S3',                     type: 'task',   priority: 'high',   label: 'enhancement',   points: 5  },
      { title: 'SSL certificates via cert-manager',              type: 'task',   priority: 'high',   label: 'enhancement',   points: 3  },
      { title: 'Prometheus + Grafana monitoring stack',          type: 'story',  priority: 'medium', label: 'enhancement',   points: 8  },
      { title: 'Staging environment parity with prod',           type: 'task',   priority: 'medium', label: 'enhancement',   points: 5  },
      { title: 'Blue-green deployment strategy',                 type: 'story',  priority: 'medium', label: 'enhancement',   points: 8  },
      { title: 'Log aggregation (ELK stack)',                    type: 'task',   priority: 'low',    label: 'enhancement',   points: 5  },
      { title: 'API gateway rate-limit config incorrect',        type: 'bug',    priority: 'urgent', label: 'bug',           points: 3  },
    ],
  };

  const STATUSES = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

  for (const project of projects) {
    /* 3 sprints per project */
    const sprint1Id = uuid();
    const sprint2Id = uuid();
    const sprint3Id = uuid();

    await knex('sprints').insert([
      {
        id: sprint1Id,
        project_id: project.id,
        name: 'Sprint 1 — Foundation',
        goal: 'Set up the core architecture and critical infrastructure.',
        status: 'completed',
        start_date: daysAgo(42),
        end_date: daysAgo(28),
      },
      {
        id: sprint2Id,
        project_id: project.id,
        name: 'Sprint 2 — Core Features',
        goal: 'Deliver the primary user-facing features.',
        status: 'active',
        start_date: daysAgo(14),
        end_date: daysAhead(0),
      },
      {
        id: sprint3Id,
        project_id: project.id,
        name: 'Sprint 3 — Polish & Launch',
        goal: 'Bug fixes, performance, and launch preparation.',
        status: 'planning',
        start_date: daysAhead(1),
        end_date: daysAhead(14),
      },
    ]);

    const sprintIds = [sprint1Id, sprint2Id, sprint3Id];
    const templates = ISSUE_TEMPLATES[project.name] ?? [];

    /* Distribute 10 issues: 3 in sprint1, 4 in sprint2, 3 in sprint3 */
    const sprintAssign = [
      sprint1Id, sprint1Id, sprint1Id,
      sprint2Id, sprint2Id, sprint2Id, sprint2Id,
      sprint3Id, sprint3Id, sprint3Id,
    ];

    /* Statuses: completed sprint → done/in_review; active → mixed; planning → backlog/todo */
    const statusBySprintMap: Record<string, string[]> = {
      [sprint1Id]: ['done', 'done', 'in_review'],
      [sprint2Id]: ['in_progress', 'in_progress', 'todo', 'in_review'],
      [sprint3Id]: ['backlog', 'todo', 'backlog'],
    };

    const issueRows: any[] = [];
    for (let i = 0; i < templates.length; i++) {
      const t = templates[i];
      const spId = sprintAssign[i];
      const statuses = statusBySprintMap[spId];
      const status = statuses[i % statuses.length];
      const assignee = i % 3 === 2 ? null : allDevIds[i % allDevIds.length]; // some unassigned

      issueRows.push({
        id: uuid(),
        project_id: project.id,
        sprint_id: spId,
        reporter_id: adminId,
        assignee_id: assignee,
        title: t.title,
        type: t.type,
        priority: t.priority,
        label: t.label,
        status,
        story_points: t.points,
        position: i + 1,
        description: `This issue is part of the ${project.name} project.\n\n**Acceptance criteria:**\n- Feature works as specified\n- Unit tests pass\n- Code reviewed and approved`,
      });
    }

    await knex('issues').insert(issueRows);
  }

  /* ══════════════════════════════════════════════════
     LEAVE PACKAGE — 2026 Annual
  ══════════════════════════════════════════════════ */
  const pkgId = uuid();
  await knex('leave_packages').insert({
    id: pkgId,
    company_id: companyId,
    created_by: hrMgrId,
    name: '2026 Annual Leave Package',
    period_start: '2026-01-01',
    period_end: '2026-12-31',
  });

  await knex('leave_package_types').insert([
    { id: uuid(), package_id: pkgId, leave_type: 'annual',    days_allowed: 21 },
    { id: uuid(), package_id: pkgId, leave_type: 'sick',      days_allowed: 10 },
    { id: uuid(), package_id: pkgId, leave_type: 'emergency', days_allowed: 3  },
    { id: uuid(), package_id: pkgId, leave_type: 'unpaid',    days_allowed: 30 },
  ]);

  /* Allocate to all employees */
  const allEmployeeIds = [adminId, ceoId, hrMgrId, productMgrId, ...allDevIds];
  await knex('employee_leave_packages').insert(
    allEmployeeIds.map((uid) => ({ id: uuid(), user_id: uid, package_id: pkgId })),
  );

  /* ══════════════════════════════════════════════════
     ANNOUNCEMENTS
  ══════════════════════════════════════════════════ */
  await knex('announcements').insert([
    {
      id: uuid(),
      company_id: companyId,
      author_id: ceoId,
      title: 'Welcome to GKK Technologies!',
      body: 'We are excited to launch our internal CompanyOS platform. All teams should update their profiles and join their respective projects. Please reach out to HR for any onboarding questions.',
      is_pinned: true,
      created_at: new Date(Date.now() - 5 * 86400000),
    },
    {
      id: uuid(),
      company_id: companyId,
      author_id: hrMgrId,
      title: 'Leave policies for 2026',
      body: 'Annual leave packages for 2026 have been assigned to all employees. You can now view your leave balance in the HR → Overview tab. Please plan your leave requests in advance and coordinate with your team leads.',
      is_pinned: false,
      created_at: new Date(Date.now() - 2 * 86400000),
    },
    {
      id: uuid(),
      company_id: companyId,
      author_id: adminId,
      title: 'Sprint 2 kickoff — all engineering teams',
      body: 'Sprint 2 has officially started across all 5 projects. Please ensure your tasks are up to date in the Issues tracker. Daily standups are at 9:30 AM via Teams. Reach out to your project lead if you are blocked.',
      is_pinned: false,
      created_at: new Date(Date.now() - 1 * 86400000),
    },
  ]);

  /* ══════════════════════════════════════════════════
     PERFORMANCE REVIEWS (sample)
  ══════════════════════════════════════════════════ */
  await knex('performance_reviews').insert([
    {
      id: uuid(),
      company_id: companyId,
      reviewer_id: adminId,
      reviewee_id: developers[0].id,
      period: 'Q4 2025',
      status: 'submitted',
      score: 4,
      feedback: 'Liam consistently delivers high-quality frontend work. Strong TypeScript skills and great eye for detail. Could improve on time estimation.',
      goals: 'Lead the mobile app frontend architecture in Q1 2026. Mentor two junior developers.',
    },
    {
      id: uuid(),
      company_id: companyId,
      reviewer_id: adminId,
      reviewee_id: developers[1].id,
      period: 'Q4 2025',
      status: 'acknowledged',
      score: 5,
      feedback: 'Aisha is an outstanding backend engineer. She redesigned the database layer and improved query performance by 40%. Highly recommended for a senior role.',
      goals: 'Take ownership of the API gateway project. Explore Rust for performance-critical services.',
    },
    {
      id: uuid(),
      company_id: companyId,
      reviewer_id: adminId,
      reviewee_id: developers[4].id,
      period: 'Q4 2025',
      status: 'draft',
      score: 4,
      feedback: 'Fatima has been instrumental in setting up the CI/CD pipeline. The automated test coverage improved from 40% to 78% under her leadership.',
      goals: 'Complete Kubernetes certification. Lead the infrastructure-as-code migration.',
    },
  ]);

  console.log(`
✅ Seed complete!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  MANAGEMENT (password: Admin@1234)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  admin@gkk.com       Alex Morgan    CTO (admin)
  ceo@gkk.com         Jordan Blake   CEO (admin)
  hr@gkk.com          Priya Sharma   HR Manager (manager)
  product@gkk.com     Sam Rivera     Product Manager (manager)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DEVELOPERS (password: Dev@1234)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  liam.chen@gkk.com         Senior Frontend Developer
  aisha.diallo@gkk.com      Backend Developer
  carlos.mendoza@gkk.com    Full-Stack Developer
  yuki.tanaka@gkk.com       Mobile Developer
  fatima.alrashid@gkk.com   DevOps Engineer
  noah.williams@gkk.com     Backend Developer
  mei.lin@gkk.com            Frontend Developer
  kofi.asante@gkk.com       QA Engineer
  sofia.petrov@gkk.com      Full-Stack Developer
  marcus.thompson@gkk.com   Senior Backend Developer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  5 projects · 3 sprints each · 10 issues each
  1 leave package · 3 performance reviews
  3 announcements
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}
