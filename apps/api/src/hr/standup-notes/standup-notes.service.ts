import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { KNEX_CONNECTION } from '../../database/database.module';
import { Role } from '../../common/enums';

interface StandupNotesActor {
  id: string;
  company_id: string;
  role: Role;
}

interface SaveStandupNote {
  standup_date: string;
  content: string;
  project_id: string;
}

@Injectable()
export class StandupNotesService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async findAll(actor: StandupNotesActor, date?: string) {
    this.assertLeadership(actor);
    const standupDate = this.validateDate(date ?? new Date().toISOString().slice(0, 10));

    const notes = await this.knex('standup_notes as sn')
      .where({
        'sn.company_id': actor.company_id,
        'sn.author_id': actor.id,
        'sn.standup_date': standupDate,
      })
      .whereNull('sn.deleted_at')
      .join('users as u', 'sn.subject_user_id', 'u.id')
      .leftJoin('projects as p', 'sn.project_id', 'p.id')
      .select(
        'sn.id',
        'sn.subject_user_id',
        'sn.project_id',
        'sn.content',
        'sn.created_at',
        'sn.updated_at',
        this.knex.raw("DATE_FORMAT(sn.standup_date, '%Y-%m-%d') as standup_date"),
        'u.first_name',
        'u.last_name',
        'u.job_title',
        'u.avatar_url',
        'u.department_id',
        'p.name as project_name',
        'p.color as project_color',
        'p.icon as project_icon',
        'p.status as project_status',
      )
      .orderBy('u.first_name')
      .orderBy('u.last_name');

    return this.formatNotes(notes);
  }

  async listProjects(actor: StandupNotesActor) {
    this.assertLeadership(actor);
    return this.knex('projects as p')
      .where('p.company_id', actor.company_id)
      .whereNull('p.deleted_at')
      .select('p.id', 'p.name', 'p.color', 'p.icon', 'p.status', 'p.department_id')
      .orderBy('p.name');
  }

  async findByProject(
    actor: StandupNotesActor,
    projectId: string,
    dateFrom?: string,
    dateTo?: string,
  ) {
    this.assertLeadership(actor);
    await this.assertCanUseProjects(actor, [projectId]);

    const query = this.knex('standup_notes as sn')
      .where({
        'sn.company_id': actor.company_id,
        'sn.author_id': actor.id,
        'sn.project_id': projectId,
      })
      .whereNull('sn.deleted_at')
      .join('users as u', 'sn.subject_user_id', 'u.id')
      .join('projects as p', 'sn.project_id', 'p.id');

    if (dateFrom) query.where('sn.standup_date', '>=', this.validateDate(dateFrom));
    if (dateTo) query.where('sn.standup_date', '<=', this.validateDate(dateTo));

    const notes = await query
      .select(
        'sn.id',
        'sn.subject_user_id',
        'sn.project_id',
        'sn.content',
        'sn.created_at',
        'sn.updated_at',
        this.knex.raw("DATE_FORMAT(sn.standup_date, '%Y-%m-%d') as standup_date"),
        'u.first_name',
        'u.last_name',
        'u.job_title',
        'u.avatar_url',
        'u.department_id',
        'p.name as project_name',
        'p.color as project_color',
        'p.icon as project_icon',
        'p.status as project_status',
      )
      .orderBy('sn.standup_date', 'desc')
      .orderBy('u.first_name');

    return this.formatNotes(notes);
  }

  async save(actor: StandupNotesActor, subjectUserId: string, data: SaveStandupNote) {
    this.assertLeadership(actor);
    const standupDate = this.validateDate(data.standup_date);
    const content = this.validateContent(data.content);
    const projectId = this.validateProjectId(data.project_id);
    await this.assertCanWriteAbout(actor, subjectUserId);
    await this.assertCanUseProjects(actor, [projectId]);

    await this.knex('standup_notes')
      .insert({
        id: uuid(),
        company_id: actor.company_id,
        author_id: actor.id,
        subject_user_id: subjectUserId,
        project_id: projectId,
        standup_date: standupDate,
        content,
      })
      .onConflict(['author_id', 'subject_user_id', 'standup_date', 'project_id'])
      .merge({
        content,
        deleted_at: null,
        updated_at: new Date(),
      });

    return this.findOne(actor, subjectUserId, projectId, standupDate);
  }

  async remove(actor: StandupNotesActor, id: string) {
    this.assertLeadership(actor);
    const updated = await this.knex('standup_notes')
      .where({
        id,
        company_id: actor.company_id,
        author_id: actor.id,
      })
      .whereNull('deleted_at')
      .update({ deleted_at: new Date(), updated_at: new Date() });

    if (!updated) throw new NotFoundException('Standup note not found');
    return { deleted: true };
  }

  private async findOne(
    actor: StandupNotesActor,
    subjectUserId: string,
    projectId: string,
    standupDate: string,
  ) {
    const note = await this.knex('standup_notes as sn')
      .where({
        'sn.company_id': actor.company_id,
        'sn.author_id': actor.id,
        'sn.subject_user_id': subjectUserId,
        'sn.project_id': projectId,
        'sn.standup_date': standupDate,
      })
      .whereNull('sn.deleted_at')
      .join('users as u', 'sn.subject_user_id', 'u.id')
      .join('projects as p', 'sn.project_id', 'p.id')
      .select(
        'sn.id',
        'sn.subject_user_id',
        'sn.project_id',
        'sn.content',
        'sn.created_at',
        'sn.updated_at',
        this.knex.raw("DATE_FORMAT(sn.standup_date, '%Y-%m-%d') as standup_date"),
        'u.first_name',
        'u.last_name',
        'u.job_title',
        'u.avatar_url',
        'u.department_id',
        'p.name as project_name',
        'p.color as project_color',
        'p.icon as project_icon',
        'p.status as project_status',
      )
      .first();

    if (!note) throw new NotFoundException('Standup note not found');
    return this.formatNotes([note])[0];
  }

  private assertLeadership(actor: StandupNotesActor) {
    if (actor.role !== Role.Admin && actor.role !== Role.Manager) {
      throw new ForbiddenException('Only admins and managers can use private standup notes');
    }
  }

  private async assertCanWriteAbout(actor: StandupNotesActor, subjectUserId: string) {
    const subject = await this.knex('users')
      .where({
        id: subjectUserId,
        company_id: actor.company_id,
        is_active: true,
      })
      .select('id')
      .first();

    if (!subject) throw new NotFoundException('Developer not found');
  }

  private async assertCanUseProjects(actor: StandupNotesActor, projectIds: string[]) {
    if (!projectIds.length) return;

    const allowedIds = await this.knex('projects as p')
      .where('p.company_id', actor.company_id)
      .whereNull('p.deleted_at')
      .whereIn('p.id', projectIds)
      .pluck('p.id');

    if (allowedIds.length !== projectIds.length) {
      throw new ForbiddenException('One or more selected projects are not accessible');
    }
  }

  private formatNotes(notes: any[]) {
    return notes.map((note) => {
      const {
        project_name,
        project_color,
        project_icon,
        project_status,
        ...rest
      } = note;
      return {
        ...rest,
        project: note.project_id
          ? {
            id: note.project_id,
            name: project_name,
            color: project_color,
            icon: project_icon,
            status: project_status,
          }
          : null,
      };
    });
  }

  private validateDate(date: string) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('standup_date must use YYYY-MM-DD');
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('standup_date is invalid');
    }
    return date;
  }

  private validateContent(content: string) {
    if (typeof content !== 'string') {
      throw new BadRequestException('content must be a string');
    }
    if (content.length > 20_000) {
      throw new BadRequestException('content cannot exceed 20,000 characters');
    }
    return content;
  }

  private validateProjectId(projectId: string) {
    if (typeof projectId !== 'string' || !projectId) {
      throw new BadRequestException('project_id is required');
    }
    return projectId;
  }
}
