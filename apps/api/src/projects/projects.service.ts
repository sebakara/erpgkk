import { Injectable, Inject, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';
import { ChatService } from '../chat/chat.service';
import { canManageAllProjects, pickEngineeringDepartment } from '../common/access/engineering';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly chatService: ChatService,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async findAll(companyId: string, userId: string, userRole?: string) {
    const projects = await this.accessibleProjects(companyId, userId, userRole);
    return this.attachPeople(projects);
  }

  private async accessibleProjects(companyId: string, userId: string, userRole?: string) {
    if (await canManageAllProjects(this.knex, companyId, userId, userRole)) {
      return this.knex('projects as p')
        .where('p.company_id', companyId)
        .whereNull('p.deleted_at')
        .select('p.*')
        .orderBy('p.created_at', 'asc');
    }

    const managedDepts = await this.knex('departments')
      .where({ company_id: companyId, manager_id: userId })
      .pluck('id');

    if (managedDepts.length > 0) {
      return this.knex('projects as p')
        .where('p.company_id', companyId)
        .whereNull('p.deleted_at')
        .whereIn('p.department_id', managedDepts)
        .select('p.*')
        .orderBy('p.created_at', 'asc');
    }

    return this.knex('projects as p')
      .where('p.company_id', companyId)
      .whereNull('p.deleted_at')
      .where((builder) => {
        builder
          .whereExists(
            this.knex('project_members as pm')
              .whereRaw('pm.project_id = p.id')
              .where('pm.user_id', userId),
          )
          .orWhereExists(
            this.knex('issues as i')
              .whereRaw('i.project_id = p.id')
              .where('i.assignee_id', userId),
          );
      })
      .select('p.*')
      .orderBy('p.created_at', 'asc');
  }

  private async attachPeople(projects: any[]) {
    if (!projects.length) return projects;
    const ids = projects.map((project) => project.id);

    const [members, owners] = await Promise.all([
      this.knex('project_members as pm')
        .join('users as u', 'pm.user_id', 'u.id')
        .whereIn('pm.project_id', ids)
        .select('pm.project_id', 'u.id', 'u.first_name', 'u.last_name', 'u.avatar_url'),
      this.knex('projects as p')
        .join('users as u', 'p.owner_id', 'u.id')
        .whereIn('p.id', ids)
        .select('p.id as project_id', 'u.id', 'u.first_name', 'u.last_name', 'u.avatar_url'),
    ]);

    const byProject = new Map<string, Map<string, {
      id: string;
      first_name: string;
      last_name: string;
      avatar_url?: string | null;
    }>>();

    const add = (projectId: string, row: { id: string; first_name: string; last_name: string; avatar_url?: string | null }) => {
      if (!projectId || !row?.id) return;
      if (!byProject.has(projectId)) byProject.set(projectId, new Map());
      const people = byProject.get(projectId)!;
      if (!people.has(row.id)) {
        people.set(row.id, {
          id: row.id,
          first_name: row.first_name,
          last_name: row.last_name,
          avatar_url: row.avatar_url,
        });
      }
    };

    for (const row of [...members, ...owners]) add(row.project_id, row);

    return projects.map((project) => ({
      ...project,
      members: [...(byProject.get(project.id)?.values() ?? [])].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
      ),
    }));
  }

  async findById(id: string, companyId: string) {
    const project = await this.knex('projects').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!project) throw new NotFoundException('Project not found');
    const members = await this.knex('project_members as pm')
      .join('users as u', 'pm.user_id', 'u.id')
      .where('pm.project_id', id)
      .select('u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.job_title', 'u.avatar_url', 'pm.role');
    return { ...project, members };
  }

  async create(companyId: string, ownerId: string, data: { name: string; description?: string; color?: string; icon?: string; department_id?: string }) {
    const id = uuid();
    const department_id = (await this.engineeringDepartmentId(companyId)) || data.department_id || null;
    await this.knex('projects').insert({
      id,
      company_id: companyId,
      owner_id: ownerId,
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      department_id,
    });
    await this.knex('project_members').insert({ id: uuid(), project_id: id, user_id: ownerId, role: 'owner' });
    await this.chatService?.getOrCreateProject(id, companyId);
    return this.findById(id, companyId);
  }

  async update(id: string, data: Partial<{ name: string; description: string; status: string; color: string; icon: string }>) {
    await this.knex('projects').where({ id }).update({ ...data, updated_at: new Date() });
    return this.knex('projects').where({ id }).first();
  }

  async addMember(projectId: string, userId: string, role = 'member') {
    const project = await this.knex('projects').where({ id: projectId }).whereNull('deleted_at').first();
    if (!project) throw new NotFoundException('Project not found');
    const user = await this.knex('users')
      .where({ id: userId, company_id: project.company_id, is_active: true })
      .first('id');
    if (!user) throw new NotFoundException('Developer not found');

    const existing = await this.knex('project_members').where({ project_id: projectId, user_id: userId }).first();
    await this.knex('project_members')
      .insert({ id: uuid(), project_id: projectId, user_id: userId, role })
      .onConflict(['project_id', 'user_id'])
      .merge({ role });
    if (!existing) {
      await this.notificationsGateway?.notifyUser(userId, {
        type: 'project_access_granted',
        title: 'Added to a project',
        body: `You now have access to ${project.name}`,
        data: { href: `/projects/${projectId}`, project_id: projectId },
      });
    }
    return this.findById(projectId, project.company_id);
  }

  async removeMember(projectId: string, userId: string) {
    const project = await this.knex('projects').where({ id: projectId }).first('owner_id', 'name');
    if (project?.owner_id === userId) {
      throw new ForbiddenException('The project owner cannot be removed');
    }
    const removed = await this.knex('project_members').where({ project_id: projectId, user_id: userId }).delete();
    if (removed && project) {
      await this.notificationsGateway?.notifyUser(userId, {
        type: 'project_access_revoked',
        title: 'Removed from a project',
        body: `You no longer have access to ${project.name}`,
        data: { href: '/projects', project_id: projectId },
      });
    }
  }

  async contributors(id: string, companyId: string) {
    const project = await this.findById(id, companyId);
    const issues = await this.knex('issues')
      .where({ project_id: id })
      .whereNull('deleted_at')
      .whereNotNull('assignee_id')
      .select('assignee_id', 'status', 'story_points');

    const statsByUser = new Map<string, {
      total: number;
      done: number;
      in_progress: number;
      story_points_completed: number;
    }>();
    for (const issue of issues) {
      const stats = statsByUser.get(issue.assignee_id) ?? {
        total: 0,
        done: 0,
        in_progress: 0,
        story_points_completed: 0,
      };
      stats.total += 1;
      if (issue.status === 'done') {
        stats.done += 1;
        stats.story_points_completed += issue.story_points ?? 0;
      }
      if (issue.status === 'in_progress' || issue.status === 'in_review') stats.in_progress += 1;
      statsByUser.set(issue.assignee_id, stats);
    }

    const empty = { total: 0, done: 0, in_progress: 0, story_points_completed: 0 };
    return (project.members ?? [])
      .map((member: any) => ({
        ...member,
        contributions: statsByUser.get(member.id) ?? empty,
      }))
      .sort((a: any, b: any) =>
        b.contributions.total - a.contributions.total
        || `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`),
      );
  }

  async remove(id: string, companyId: string) {
    const updated = await this.knex('projects')
      .where({ id, company_id: companyId })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date(), updated_at: new Date() });
    if (!updated) throw new NotFoundException('Project not found');
    return { deleted: true };
  }

  private async engineeringDepartmentId(companyId: string) {
    const depts = await this.knex('departments')
      .where({ company_id: companyId })
      .whereNull('deleted_at')
      .select('id', 'name');
    return pickEngineeringDepartment(depts)?.id ?? null;
  }

  async workspaceStats(companyId: string, userId: string, userRole?: string) {
    const projects = await this.accessibleProjects(companyId, userId, userRole);
    const ids = projects.map((project) => project.id);
    const empty = {
      total: 0,
      done: 0,
      inProgress: 0,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      byProject: [] as { id: string; name: string; total: number; done: number; open: number }[],
    };
    if (!ids.length) return empty;

    const issuesQuery = this.knex('issues')
      .whereIn('project_id', ids)
      .whereNull('deleted_at')
      .select('project_id', 'status', 'priority');
    if (userRole === 'employee') issuesQuery.where('assignee_id', userId);
    const issues = await issuesQuery;

    const byStatus = issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.status] = (acc[issue.status] ?? 0) + 1;
      return acc;
    }, {});
    const byPriority = issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.priority] = (acc[issue.priority] ?? 0) + 1;
      return acc;
    }, {});

    const counts = new Map<string, { total: number; done: number }>();
    for (const issue of issues) {
      const current = counts.get(issue.project_id) ?? { total: 0, done: 0 };
      current.total += 1;
      if (issue.status === 'done') current.done += 1;
      counts.set(issue.project_id, current);
    }

    const byProject = projects
      .map((project) => {
        const stats = counts.get(project.id) ?? { total: 0, done: 0 };
        return {
          id: project.id,
          name: project.name,
          total: stats.total,
          done: stats.done,
          open: stats.total - stats.done,
        };
      })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.open - a.open || b.total - a.total)
      .slice(0, 8);

    return {
      total: issues.length,
      done: issues.filter((issue) => issue.status === 'done').length,
      inProgress: issues.filter((issue) => issue.status === 'in_progress').length,
      byStatus,
      byPriority,
      byProject,
    };
  }

  async analytics(id: string) {
    const [issues, sprints] = await Promise.all([
      this.knex('issues').where({ project_id: id }).select('status', 'story_points', 'priority', 'type', 'sprint_id', 'created_at'),
      this.knex('sprints').where({ project_id: id }).orderBy('created_at', 'asc'),
    ]);

    // Issue breakdown by status
    const byStatus = issues.reduce<Record<string, number>>((acc, i) => {
      acc[i.status] = (acc[i.status] ?? 0) + 1;
      return acc;
    }, {});

    // Issue breakdown by priority
    const byPriority = issues.reduce<Record<string, number>>((acc, i) => {
      acc[i.priority] = (acc[i.priority] ?? 0) + 1;
      return acc;
    }, {});

    // Issue breakdown by type
    const byType = issues.reduce<Record<string, number>>((acc, i) => {
      acc[i.type] = (acc[i.type] ?? 0) + 1;
      return acc;
    }, {});

    // Sprint velocity: points completed per sprint
    const velocity = sprints.map((s) => {
      const sprintIssues = issues.filter((i) => i.sprint_id === s.id);
      const completed = sprintIssues.filter((i) => i.status === 'done').reduce((sum, i) => sum + (i.story_points ?? 0), 0);
      const total = sprintIssues.reduce((sum, i) => sum + (i.story_points ?? 0), 0);
      return { sprint: s.name, completed, total, status: s.status };
    });

    // Health score: % done out of total (0–100)
    const total = issues.length;
    const done = issues.filter((i) => i.status === 'done').length;
    const health = total === 0 ? 100 : Math.round((done / total) * 100);

    return {
      total,
      done,
      inProgress: issues.filter((i) => i.status === 'in_progress').length,
      byStatus,
      byPriority,
      byType,
      velocity,
      health,
      sprintCount: sprints.length,
    };
  }

  async overview(id: string, companyId: string) {
    const project = await this.findById(id, companyId);
    const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [issues, sprints, docs, files, standup] = await Promise.all([
      this.knex('issues as i')
        .where('i.project_id', id)
        .whereNull('i.deleted_at')
        .leftJoin('users as u', 'i.assignee_id', 'u.id')
        .select(
          'i.id', 'i.title', 'i.status', 'i.priority', 'i.type',
          'i.sprint_id', 'i.assignee_id', 'i.updated_at',
          'u.first_name as assignee_first_name',
          'u.last_name as assignee_last_name',
        ),
      this.knex('sprints').where({ project_id: id }).orderBy('created_at', 'asc'),
      this.knex('docs').where({ project_id: id }).whereNull('deleted_at')
        .select('id', 'title', 'updated_at').orderBy('updated_at', 'desc').limit(3),
      this.knex('project_files').where({ project_id: id }).whereNull('deleted_at')
        .select('id', 'original_name', 'created_at').orderBy('created_at', 'desc').limit(3),
      this.knex('standup_notes as sn')
        .where('sn.project_id', id)
        .whereNull('sn.deleted_at')
        .join('users as u', 'sn.subject_user_id', 'u.id')
        .select(
          'sn.id', 'sn.content', 'sn.standup_date', 'sn.updated_at',
          'u.first_name', 'u.last_name',
        )
        .orderBy('sn.standup_date', 'desc')
        .orderBy('sn.updated_at', 'desc')
        .limit(5)
        .then((rows) => rows)
        .catch(() => [] as any[]),
    ]);

    const openIssues = issues.filter((i) => i.status !== 'done');
    const doneIssues = issues.filter((i) => i.status === 'done');
    const backlog = issues.filter((i) => i.status === 'backlog').length;
    const todo = issues.filter((i) => i.status === 'todo').length;
    const inProgress = issues.filter((i) => i.status === 'in_progress').length;
    const inReview = issues.filter((i) => i.status === 'in_review').length;
    const urgentOpen = openIssues.filter((i) => i.priority === 'urgent').length;
    const bugsOpen = openIssues.filter((i) => i.type === 'bug').length;
    const unassigned = openIssues.filter((i) => !i.assignee_id).length;

    const stale = openIssues
      .filter((i) => (i.status === 'in_progress' || i.status === 'in_review')
        && i.updated_at && new Date(i.updated_at) < staleBefore)
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 8)
      .map((i) => ({
        id: i.id,
        title: i.title,
        status: i.status,
        priority: i.priority,
        updated_at: i.updated_at,
        assignee_name: i.assignee_first_name
          ? `${i.assignee_first_name} ${i.assignee_last_name}`.trim()
          : null,
      }));

    const load = new Map<string, { id: string; name: string; open: number }>();
    for (const i of openIssues) {
      if (!i.assignee_id || !i.assignee_first_name) continue;
      const current = load.get(i.assignee_id) ?? {
        id: i.assignee_id,
        name: `${i.assignee_first_name} ${i.assignee_last_name}`.trim(),
        open: 0,
      };
      current.open += 1;
      load.set(i.assignee_id, current);
    }
    const people = [...load.values()].sort((a, b) => b.open - a.open).slice(0, 6);

    const activeSprint = sprints.find((s) => s.status === 'active') ?? null;
    let sprint: {
      id: string; name: string; goal?: string; start_date?: string; end_date?: string;
      total: number; done: number;
    } | null = null;
    if (activeSprint) {
      const inSprint = issues.filter((i) => i.sprint_id === activeSprint.id);
      sprint = {
        id: activeSprint.id,
        name: activeSprint.name,
        goal: activeSprint.goal,
        start_date: activeSprint.start_date,
        end_date: activeSprint.end_date,
        total: inSprint.length,
        done: inSprint.filter((i) => i.status === 'done').length,
      };
    }

    const recentlyDone = [...doneIssues]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
      .map((i) => ({
        id: i.id,
        title: i.title,
        updated_at: i.updated_at,
        assignee_name: i.assignee_first_name
          ? `${i.assignee_first_name} ${i.assignee_last_name}`.trim()
          : null,
      }));

    const top = people[0] ?? null;
    const briefing = this.buildOverviewBriefing({
      sprint,
      total: issues.length,
      backlog,
      todo,
      inProgress,
      inReview,
      done: doneIssues.length,
      urgent: urgentOpen,
      bugs: bugsOpen,
      stale: stale.length,
      unassigned,
      top,
      recentCount: recentlyDone.length,
    });

    return {
      briefing,
      description: project.description ?? null,
      counts: {
        total: issues.length,
        open: openIssues.length,
        done: doneIssues.length,
        inProgress,
        inReview,
        urgent: urgentOpen,
        bugs: bugsOpen,
        unassigned,
      },
      sprint,
      stale,
      people,
      recentlyDone,
      docs: docs.map((d) => ({ id: d.id, title: d.title, updated_at: d.updated_at })),
      files: files.map((f) => ({ id: f.id, name: f.original_name, created_at: f.created_at })),
      standup: standup.map((n: any) => ({
        id: n.id,
        content: String(n.content ?? '').slice(0, 220),
        standup_date: n.standup_date,
        subject_name: `${n.first_name} ${n.last_name}`.trim(),
      })),
    };
  }

  private joinList(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
  }

  private plural(n: number, one: string, many: string) {
    return n === 1 ? one : many;
  }

  private buildOverviewBriefing(input: {
    sprint: { name: string; total: number; done: number; goal?: string } | null;
    total: number;
    backlog: number;
    todo: number;
    inProgress: number;
    inReview: number;
    done: number;
    urgent: number;
    bugs: number;
    stale: number;
    unassigned: number;
    top: { name: string; open: number } | null;
    recentCount: number;
  }) {
    const paragraphs: string[] = [];

    if (input.total === 0) {
      paragraphs.push(
        input.sprint
          ? `${input.sprint.name} is active, but this project has no issues yet.`
          : 'This project has no issues yet, and no sprint is currently active.',
      );
    } else {
      const statusBits = this.joinList([
        input.backlog ? `${input.backlog} in the backlog` : '',
        input.todo ? `${input.todo} to do` : '',
        input.inProgress ? `${input.inProgress} in progress` : '',
        input.inReview ? `${input.inReview} in review` : '',
        input.done ? `${input.done} done` : '',
      ].filter(Boolean));

      let status = `This project has ${input.total} ${this.plural(input.total, 'issue', 'issues')}`;
      status += statusBits ? `: ${statusBits}.` : '.';

      if (input.sprint) {
        if (input.sprint.total) {
          const pct = Math.round((input.sprint.done / input.sprint.total) * 100);
          status += ` ${input.sprint.name} is active, with ${input.sprint.done} of ${input.sprint.total} issues done (${pct}%).`;
        } else {
          status += ` ${input.sprint.name} is active but has no issues in it yet.`;
        }
        const goal = input.sprint.goal?.replace(/\s+/g, ' ').trim();
        if (goal) {
          status += ` The sprint goal is ${goal.replace(/[.]+$/, '')}.`;
        }
      } else {
        status += ' No sprint is currently active.';
      }
      paragraphs.push(status);
    }

    const attention = [
      input.urgent ? `${input.urgent} urgent ${this.plural(input.urgent, 'item', 'items')}` : '',
      input.bugs ? `${input.bugs} open ${this.plural(input.bugs, 'bug', 'bugs')}` : '',
      input.stale
        ? `${input.stale} ${this.plural(input.stale, 'issue that has', 'issues that have')} been in progress or review for more than a week`
        : '',
      input.unassigned
        ? `${input.unassigned} unassigned ${this.plural(input.unassigned, 'open issue', 'open issues')}`
        : '',
    ].filter(Boolean);

    const follow: string[] = [];
    if (attention.length) follow.push(`Needs attention: ${this.joinList(attention)}.`);
    if (input.top) {
      follow.push(`${input.top.name} currently has the most open work (${input.top.open}).`);
    }
    if (input.recentCount) {
      follow.push(
        `${input.recentCount} ${this.plural(input.recentCount, 'issue was', 'issues were')} marked done recently.`,
      );
    }
    if (follow.length) paragraphs.push(follow.join(' '));

    return paragraphs.join('\n\n');
  }
}
