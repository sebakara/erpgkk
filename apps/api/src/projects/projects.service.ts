import { Injectable, Inject, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';
import { ChatService } from '../chat/chat.service';

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
          );
      })
      .select('p.*')
      .orderBy('p.created_at', 'asc');
  }

  async findById(id: string, companyId: string) {
    const project = await this.knex('projects').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!project) throw new NotFoundException('Project not found');
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
    await this.knex('project_members')
      .insert({ id: uuid(), project_id: projectId, user_id: userId, role })
      .onConflict(['project_id', 'user_id'])
      .merge({ role });
  }

  async removeMember(projectId: string, userId: string) {
    await this.knex('project_members').where({ project_id: projectId, user_id: userId }).delete();
  }

  remove(id: string, companyId: string) {
    return this.knex('projects').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
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
}
