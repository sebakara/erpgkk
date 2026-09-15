import { Injectable, Inject, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';
import { ChatService } from '../chat/chat.service';
import { userManagesProject } from '../common/access/projects';

function fillDays(n: number): Array<{ date: string; count: number }> {
  const days: Array<{ date: string; count: number }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const offset = d.getTimezoneOffset() * 60000;
    days.push({ date: new Date(d.getTime() - offset).toISOString().slice(0, 10), count: 0 });
  }
  return days;
}

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly chatService: ChatService,
  ) {}

  async findAll(companyId: string, userId: string, userRole?: string) {
    if (userRole === 'admin') {
      return this.knex('projects as p')
        .where('p.company_id', companyId)
        .whereNull('p.deleted_at')
        .select('p.*')
        .orderBy('p.created_at', 'asc');
    }

    if (userRole === 'project_manager') {
      return this.knex('projects as p')
        .where('p.company_id', companyId)
        .whereNull('p.deleted_at')
        .where((builder) => {
          builder
            .where('p.owner_id', userId)
            .orWhereExists(
              this.knex('project_members as pm')
                .whereRaw('pm.project_id = p.id')
                .where('pm.user_id', userId)
                .whereIn('pm.role', ['owner', 'manager']),
            );
        })
        .select('p.*')
        .orderBy('p.created_at', 'asc');
    }

    // Find departments where this user is the manager (dept head)
    const managedDepts = await this.knex('departments')
      .where({ company_id: companyId, manager_id: userId })
      .pluck('id');

    if (managedDepts.length > 0) {
      // Dept head: all projects in their department(s)
      return this.knex('projects as p')
        .where('p.company_id', companyId)
        .whereNull('p.deleted_at')
        .whereIn('p.department_id', managedDepts)
        .select('p.*')
        .orderBy('p.created_at', 'asc');
    }

    // Employee/HR: projects they're a member of OR have issues assigned to them
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
          )
          .orWhereExists(
            this.knex('issue_assignees as ia')
              .join('issues as i', 'i.id', 'ia.issue_id')
              .whereRaw('i.project_id = p.id')
              .whereNull('i.deleted_at')
              .andWhere('ia.user_id', userId),
          );
      })
      .select('p.*')
      .orderBy('p.created_at', 'asc');
  }

  async workspaceOverview(companyId: string, userId: string, userRole?: string) {
    const projects = await this.findAll(companyId, userId, userRole);
    const ids = (projects as any[]).map((p) => p.id);
    const emptyDays = fillDays(14);

    if (!ids.length) {
      return {
        projects: { total: 0, active: 0, archived: 0, completed: 0 },
        issues: {
          total: 0, done: 0, inProgress: 0, open: 0, overdue: 0,
          byStatus: {}, byPriority: {}, byType: {},
          created_last_14d: emptyDays,
        },
        byProject: [],
        mine: { open: 0, inProgress: 0, todo: 0, overdue: 0 },
        mine_issues: [],
      };
    }

    const [issues, repoRows, sprints] = await Promise.all([
      this.knex('issues')
        .whereIn('project_id', ids)
        .whereNull('deleted_at')
        .select('id', 'project_id', 'status', 'priority', 'type', 'assignee_id', 'created_at', 'title', 'due_date', 'sprint_id'),
      this.knex('project_github_repositories')
        .whereIn('project_id', ids)
        .groupBy('project_id')
        .select('project_id')
        .count('* as c'),
      this.knex('sprints')
        .whereIn('project_id', ids)
        .whereNull('deleted_at')
        .select('id', 'project_id', 'name', 'status'),
    ]);

    const reposByProject = new Map(repoRows.map((row: any) => [row.project_id, Number(row.c)]));
    const sprintById = new Map((sprints as any[]).map((s) => [s.id, s]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isOverdue = (issue: any) => {
      if (!issue.due_date || issue.status === 'done') return false;
      const day = new Date(`${String(issue.due_date).slice(0, 10)}T00:00:00`);
      return !Number.isNaN(day.getTime()) && day < today;
    };
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const createdByDay = new Map(emptyDays.map((d) => [d.date, 0]));
    const since14 = new Date();
    since14.setHours(0, 0, 0, 0);
    since14.setDate(since14.getDate() - 13);

    for (const issue of issues) {
      byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1;
      byPriority[issue.priority] = (byPriority[issue.priority] ?? 0) + 1;
      byType[issue.type] = (byType[issue.type] ?? 0) + 1;
      const created = issue.created_at ? new Date(issue.created_at) : null;
      if (created && created >= since14) {
        const key = new Date(created.getTime() - created.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        if (createdByDay.has(key)) createdByDay.set(key, (createdByDay.get(key) ?? 0) + 1);
      }
    }

    const done = byStatus.done ?? 0;
    const inProgress = (byStatus.in_progress ?? 0) + (byStatus.in_review ?? 0);
    const overdue = issues.filter(isOverdue).length;
    const coAssignedIds: string[] = issues.length
      ? await this.knex('issue_assignees')
          .where({ user_id: userId })
          .whereIn('issue_id', issues.map((i: any) => i.id))
          .pluck('issue_id')
      : [];
    const mineSet = new Set(coAssignedIds);
    const mineIssues = issues.filter((i) => (i.assignee_id === userId || mineSet.has(i.id)) && i.status !== 'done');

    const byProject = (projects as any[]).map((p) => {
      const rows = issues.filter((i) => i.project_id === p.id);
      const total = rows.length;
      const projectDone = rows.filter((i) => i.status === 'done').length;
      const activeSprint = (sprints as any[]).find((s) => s.project_id === p.id && s.status === 'active');
      return {
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        status: p.status,
        total,
        done: projectDone,
        open: total - projectDone,
        overdue: rows.filter(isOverdue).length,
        inProgress: rows.filter((i) => i.status === 'in_progress' || i.status === 'in_review').length,
        health: total === 0 ? 100 : Math.round((projectDone / total) * 100),
        github_repos: reposByProject.get(p.id) ?? 0,
        active_sprint: activeSprint ? { id: activeSprint.id, name: activeSprint.name } : null,
      };
    });

    return {
      projects: {
        total: projects.length,
        active: (projects as any[]).filter((p) => p.status === 'active').length,
        archived: (projects as any[]).filter((p) => p.status === 'archived').length,
        completed: (projects as any[]).filter((p) => p.status === 'completed').length,
      },
      issues: {
        total: issues.length,
        done,
        inProgress,
        open: issues.length - done,
        overdue,
        byStatus,
        byPriority,
        byType,
        created_last_14d: emptyDays.map((d) => ({ date: d.date, count: createdByDay.get(d.date) ?? 0 })),
      },
      byProject,
      mine: {
        open: mineIssues.length,
        inProgress: mineIssues.filter((i) => i.status === 'in_progress' || i.status === 'in_review').length,
        todo: mineIssues.filter((i) => i.status === 'todo' || i.status === 'backlog').length,
        overdue: mineIssues.filter(isOverdue).length,
      },
      mine_issues: mineIssues.map((i) => {
        const sprint = i.sprint_id ? sprintById.get(i.sprint_id) : null;
        const project = (projects as any[]).find((p) => p.id === i.project_id);
        return {
          id: i.id,
          project_id: i.project_id,
          project_name: project?.name,
          project_icon: project?.icon,
          title: i.title,
          status: i.status,
          priority: i.priority,
          due_date: i.due_date,
          sprint_id: i.sprint_id,
          sprint_name: sprint?.name,
          sprint_status: sprint?.status,
        };
      }),
    };
  }

  async findById(id: string, companyId: string, actor?: { id: string; role?: string }) {
    const project = await this.knex('projects').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!project) throw new NotFoundException('Project not found');
    if (actor?.role === 'project_manager' && !(await userManagesProject(this.knex, id, actor.id))) {
      throw new ForbiddenException('You do not manage this project');
    }
    const members = await this.knex('project_members as pm')
      .join('users as u', 'pm.user_id', 'u.id')
      .where('pm.project_id', id)
      .select('u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.avatar_url', 'pm.role');
    return { ...project, members };
  }

  async create(companyId: string, ownerId: string, data: { name: string; description?: string; color?: string; icon?: string; department_id?: string }) {
    const id = uuid();
    await this.knex('projects').insert({ id, company_id: companyId, owner_id: ownerId, ...data });
    await this.knex('project_members').insert({ id: uuid(), project_id: id, user_id: ownerId, role: 'owner' });
    await this.chatService?.getOrCreateProject(id, companyId);
    return this.findById(id, companyId);
  }

  async update(id: string, data: Partial<{ name: string; description: string; status: string; color: string; icon: string }>) {
    await this.knex('projects').where({ id }).update({ ...data, updated_at: new Date() });
    return this.knex('projects').where({ id }).first();
  }

  async addMember(projectId: string, userId: string, role = 'member') {
    const person = await this.knex('users').where({ id: userId }).first();
    const memberRole = role === 'owner'
      ? 'owner'
      : person?.role === 'project_manager' || role === 'manager'
        ? 'manager'
        : (role || 'member');
    await this.knex('project_members')
      .insert({ id: uuid(), project_id: projectId, user_id: userId, role: memberRole })
      .onConflict(['project_id', 'user_id'])
      .merge({ role: memberRole });
  }

  async removeMember(projectId: string, userId: string) {
    await this.knex('project_members').where({ project_id: projectId, user_id: userId }).delete();
  }

  remove(id: string, companyId: string) {
    return this.knex('projects').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
  }

  async analytics(id: string) {
    const [issues, sprints, github] = await Promise.all([
      this.knex('issues').where({ project_id: id }).select('status', 'story_points', 'priority', 'type', 'sprint_id', 'created_at'),
      this.knex('sprints').where({ project_id: id }).orderBy('created_at', 'asc'),
      this.githubAnalytics(id),
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
      const completedPts = sprintIssues.filter((i) => i.status === 'done').reduce((sum, i) => sum + (i.story_points ?? 0), 0);
      const totalPts = sprintIssues.reduce((sum, i) => sum + (i.story_points ?? 0), 0);
      const doneCount = sprintIssues.filter((i) => i.status === 'done').length;
      const totalCount = sprintIssues.length;
      return {
        sprint: s.name,
        completed: completedPts,
        total: totalPts,
        status: s.status,
        issues_done: doneCount,
        issues_total: totalCount,
        pct: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
      };
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
      github,
    };
  }

  private async githubAnalytics(projectId: string) {
    const emptyDays = fillDays(14);
    const repoIds: string[] = await this.knex('project_github_repositories')
      .where('project_id', projectId)
      .pluck('github_repository_id');

    let linked_prs = 0;
    let issues_with_prs = 0;
    if (await this.knex.schema.hasTable('github_pr_links')) {
      const linked = await this.knex('github_pr_links as l')
        .join('issues as i', 'i.id', 'l.issue_id')
        .where('i.project_id', projectId)
        .whereNull('i.deleted_at')
        .select(
          this.knex.raw('COUNT(DISTINCT l.pull_request_id) as prs'),
          this.knex.raw('COUNT(DISTINCT l.issue_id) as issues'),
        )
        .first();
      linked_prs = Number((linked as any)?.prs ?? 0);
      issues_with_prs = Number((linked as any)?.issues ?? 0);
    }

    if (!repoIds.length) {
      return {
        repo_count: 0,
        open_prs: 0,
        merged_prs_30d: 0,
        commits_14d: 0,
        linked_prs,
        issues_with_prs,
        commits_by_day: emptyDays,
        prs_merged_by_day: emptyDays,
        prs_by_state: [
          { name: 'Open', value: 0 },
          { name: 'Merged', value: 0 },
          { name: 'Closed', value: 0 },
        ],
        contributors: [],
      };
    }

    const since14 = new Date();
    since14.setHours(0, 0, 0, 0);
    since14.setDate(since14.getDate() - 13);
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [openPrs, mergedPrs, commitDays, mergedDays, prStates, mergedAll, commitAuthors, prAuthors] = await Promise.all([
      this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).andWhere('state', 'open').count('* as c').first(),
      this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).where('merged', true).where('merged_at', '>=', since30).count('* as c').first(),
      this.knex('github_commits')
        .whereIn('github_repository_id', repoIds)
        .where('committed_at', '>=', since14)
        .select(this.knex.raw('DATE(committed_at) as day'))
        .count('* as c')
        .groupByRaw('DATE(committed_at)'),
      this.knex('github_pull_requests')
        .whereIn('github_repository_id', repoIds)
        .where('merged', true)
        .where('merged_at', '>=', since14)
        .select(this.knex.raw('DATE(merged_at) as day'))
        .count('* as c')
        .groupByRaw('DATE(merged_at)'),
      this.knex('github_pull_requests')
        .whereIn('github_repository_id', repoIds)
        .select('state', 'merged')
        .count('* as c')
        .groupBy('state', 'merged'),
      this.knex('github_pull_requests').whereIn('github_repository_id', repoIds).where('merged', true).count('* as c').first(),
      this.knex('github_commits')
        .whereIn('github_repository_id', repoIds)
        .whereNotNull('author_login')
        .groupBy('author_github_user_id', 'author_login')
        .select('author_github_user_id as github_user_id', 'author_login as login')
        .count('* as commit_count')
        .orderBy('commit_count', 'desc')
        .limit(8),
      this.knex('github_pull_requests')
        .whereIn('github_repository_id', repoIds)
        .whereNotNull('author_login')
        .groupBy('github_author_id', 'author_login')
        .select('github_author_id as github_user_id', 'author_login as login')
        .count('* as pr_count'),
    ]);

    const commits_by_day = emptyDays.map((d) => {
      const row = (commitDays as any[]).find((r) => String(r.day).slice(0, 10) === d.date);
      return { date: d.date, count: Number(row?.c ?? 0) };
    });
    const prs_merged_by_day = emptyDays.map((d) => {
      const row = (mergedDays as any[]).find((r) => String(r.day).slice(0, 10) === d.date);
      return { date: d.date, count: Number(row?.c ?? 0) };
    });

    let openCount = 0;
    let closedCount = 0;
    for (const row of prStates as any[]) {
      const n = Number(row.c ?? 0);
      if (row.state === 'open') openCount += n;
      else closedCount += n;
    }
    const mergedCount = Number((mergedAll as any)?.c ?? 0);

    const prByLogin = new Map((prAuthors as any[]).map((r) => [r.login, Number(r.pr_count ?? 0)]));
    const contributors = (commitAuthors as any[]).map((row) => ({
      login: row.login,
      github_user_id: row.github_user_id != null ? String(row.github_user_id) : null,
      commit_count: Number(row.commit_count ?? 0),
      pr_count: prByLogin.get(row.login) ?? 0,
      name: `@${row.login}`,
      avatar_url: null as string | null,
    }));

    const ghIds = contributors.map((c) => c.github_user_id).filter(Boolean) as string[];
    const accounts = ghIds.length
      ? await this.knex('user_github_accounts as a')
          .join('users as u', 'u.id', 'a.user_id')
          .whereIn('a.github_user_id', ghIds)
          .select('a.github_user_id', 'u.first_name', 'u.last_name', 'u.avatar_url')
      : [];
    const byGhId = new Map(accounts.map((a) => [String(a.github_user_id), a]));
    for (const person of contributors) {
      const mapped = person.github_user_id ? byGhId.get(person.github_user_id) : null;
      if (mapped) {
        person.name = `${mapped.first_name} ${mapped.last_name}`;
        person.avatar_url = mapped.avatar_url ?? null;
      }
    }

    return {
      repo_count: repoIds.length,
      open_prs: Number((openPrs as any)?.c ?? 0),
      merged_prs_30d: Number((mergedPrs as any)?.c ?? 0),
      commits_14d: commits_by_day.reduce((sum, d) => sum + d.count, 0),
      linked_prs,
      issues_with_prs,
      commits_by_day,
      prs_merged_by_day,
      prs_by_state: [
        { name: 'Open', value: openCount },
        { name: 'Merged', value: mergedCount },
        { name: 'Closed', value: Math.max(0, closedCount - mergedCount) },
      ],
      contributors,
    };
  }
}
