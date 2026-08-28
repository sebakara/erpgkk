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
}

@Injectable()
export class StandupNotesService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async findAll(actor: StandupNotesActor, date?: string) {
    this.assertLeadership(actor);
    const standupDate = this.validateDate(date ?? new Date().toISOString().slice(0, 10));

    return this.knex('standup_notes as sn')
      .where({
        'sn.company_id': actor.company_id,
        'sn.author_id': actor.id,
        'sn.standup_date': standupDate,
      })
      .whereNull('sn.deleted_at')
      .join('users as u', 'sn.subject_user_id', 'u.id')
      .select(
        'sn.id',
        'sn.subject_user_id',
        'sn.content',
        'sn.created_at',
        'sn.updated_at',
        this.knex.raw("DATE_FORMAT(sn.standup_date, '%Y-%m-%d') as standup_date"),
        'u.first_name',
        'u.last_name',
        'u.job_title',
        'u.avatar_url',
        'u.department_id',
      )
      .orderBy('u.first_name')
      .orderBy('u.last_name');
  }

  async save(actor: StandupNotesActor, subjectUserId: string, data: SaveStandupNote) {
    this.assertLeadership(actor);
    const standupDate = this.validateDate(data.standup_date);
    const content = this.validateContent(data.content);
    await this.assertCanWriteAbout(actor, subjectUserId);

    await this.knex('standup_notes')
      .insert({
        id: uuid(),
        company_id: actor.company_id,
        author_id: actor.id,
        subject_user_id: subjectUserId,
        standup_date: standupDate,
        content,
      })
      .onConflict(['author_id', 'subject_user_id', 'standup_date'])
      .merge({
        content,
        deleted_at: null,
        updated_at: new Date(),
      });

    return this.findOne(actor, subjectUserId, standupDate);
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

  private async findOne(actor: StandupNotesActor, subjectUserId: string, standupDate: string) {
    const note = await this.knex('standup_notes as sn')
      .where({
        'sn.company_id': actor.company_id,
        'sn.author_id': actor.id,
        'sn.subject_user_id': subjectUserId,
        'sn.standup_date': standupDate,
      })
      .whereNull('sn.deleted_at')
      .join('users as u', 'sn.subject_user_id', 'u.id')
      .select(
        'sn.id',
        'sn.subject_user_id',
        'sn.content',
        'sn.created_at',
        'sn.updated_at',
        this.knex.raw("DATE_FORMAT(sn.standup_date, '%Y-%m-%d') as standup_date"),
        'u.first_name',
        'u.last_name',
        'u.job_title',
        'u.avatar_url',
        'u.department_id',
      )
      .first();

    if (!note) throw new NotFoundException('Standup note not found');
    return note;
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
      .select('id', 'department_id')
      .first();

    if (!subject) throw new NotFoundException('Developer not found');
    if (actor.role === Role.Admin) return;

    const managesDepartment = subject.department_id
      ? await this.knex('departments')
        .where({
          id: subject.department_id,
          company_id: actor.company_id,
          manager_id: actor.id,
        })
        .first('id')
      : null;

    if (!managesDepartment) {
      throw new ForbiddenException('You can only write notes about developers in your departments');
    }
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
}
