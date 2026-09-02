import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';
import { DeptNotifierService } from '../dept-notifier.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class PerformanceService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly deptNotifier: DeptNotifierService,
  ) {}

  findAll(
    companyId: string,
    userId: string,
    role: string,
    filters: { reviewee_id?: string; date_from?: string; date_to?: string } = {},
  ) {
    const q = this.knex('performance_reviews as pr')
      .where('pr.company_id', companyId)
      .whereNull('pr.deleted_at')
      .leftJoin('users as reviewer', 'pr.reviewer_id', 'reviewer.id')
      .leftJoin('users as reviewee', 'pr.reviewee_id', 'reviewee.id')
      .leftJoin('departments as d', 'reviewee.department_id', 'd.id')
      .select(
        'pr.*',
        this.knex.raw("CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name"),
        this.knex.raw("CONCAT(reviewee.first_name, ' ', reviewee.last_name) as reviewee_name"),
        'reviewee.avatar_url as reviewee_avatar',
        'reviewee.job_title as reviewee_job_title',
        'd.name as reviewee_department',
      )
      .orderBy('pr.created_at', 'desc');

    if (role === 'employee') {
      q.where(function () {
        this.where('pr.reviewer_id', userId).orWhere('pr.reviewee_id', userId);
      });
    }

    if (filters.reviewee_id) q.where('pr.reviewee_id', filters.reviewee_id);
    if (filters.date_from)   q.where('pr.created_at', '>=', filters.date_from);
    if (filters.date_to)     q.where('pr.created_at', '<=', filters.date_to + ' 23:59:59');

    return q;
  }

  findById(id: string) {
    return this.knex('performance_reviews as pr')
      .where('pr.id', id)
      .leftJoin('users as reviewer', 'pr.reviewer_id', 'reviewer.id')
      .leftJoin('users as reviewee', 'pr.reviewee_id', 'reviewee.id')
      .select(
        'pr.*',
        this.knex.raw("CONCAT(reviewer.first_name, ' ', reviewer.last_name) as reviewer_name"),
        this.knex.raw("CONCAT(reviewee.first_name, ' ', reviewee.last_name) as reviewee_name"),
      )
      .first();
  }

  async create(companyId: string, reviewerId: string, data: {
    reviewee_id: string;
    period: string;
    score?: number;
    feedback?: string;
    goals?: string;
  }) {
    const id = uuid();
    await this.knex('performance_reviews').insert({
      id,
      company_id: companyId,
      reviewer_id: reviewerId,
      ...data,
      status: 'draft',
    });

    // Notify dept head of the reviewee that a review was created for them
    const reviewer = await this.knex('users').where({ id: reviewerId }).select('first_name', 'last_name').first();
    const reviewee = await this.knex('users').where({ id: data.reviewee_id }).select('first_name', 'last_name').first();
    if (reviewer && reviewee) {
        await this.deptNotifier.notifyHead(data.reviewee_id, {
          type: 'performance_review_created',
          title: 'Performance review created',
          body: `${reviewer.first_name} ${reviewer.last_name} created a review for ${reviewee.first_name} ${reviewee.last_name} — ${data.period}`,
          data: { href: '/hr?tab=performance', review_id: id },
        });
    }

    return this.findById(id);
  }

  async update(id: string, userId: string, data: {
    status?: string;
    score?: number;
    feedback?: string;
    goals?: string;
    period?: string;
    reviewee_id?: string;
  }) {
    const review = await this.knex('performance_reviews').where({ id }).first();
    if (!review) throw new ForbiddenException('Review not found');
    if (review.reviewer_id !== userId && review.reviewee_id !== userId) {
      throw new ForbiddenException('Not authorized');
    }

    await this.knex('performance_reviews').where({ id }).update({ ...data, updated_at: new Date() });

    // Notify dept head when review is submitted
    if (data.status === 'submitted') {
      const reviewer = await this.knex('users').where({ id: review.reviewer_id }).select('first_name', 'last_name').first();
      const reviewee = await this.knex('users').where({ id: review.reviewee_id }).select('first_name', 'last_name').first();
      if (reviewer && reviewee) {
        await this.deptNotifier.notifyHead(review.reviewee_id, {
          type: 'performance_review_submitted',
          title: 'Performance review submitted',
          body: `${reviewer.first_name} ${reviewer.last_name} submitted a review for ${reviewee.first_name} ${reviewee.last_name}`,
          data: { href: '/hr?tab=performance', review_id: id },
        });
        if (review.reviewee_id !== userId) {
          await this.deptNotifier.notifyUser(review.reviewee_id, {
            type: 'performance_review_submitted',
            title: 'You have a new performance review',
            body: `${reviewer.first_name} ${reviewer.last_name} submitted your ${review.period} review`,
            data: { href: '/hr?tab=performance', review_id: id },
          });
        }
      }
    }

    if (data.status === 'acknowledged' && review.status !== 'acknowledged' && review.reviewer_id !== userId) {
      const reviewee = await this.knex('users').where({ id: review.reviewee_id }).select('first_name', 'last_name').first();
      await this.deptNotifier.notifyUser(review.reviewer_id, {
        type: 'performance_review_submitted',
        title: 'Review acknowledged',
        body: `${reviewee ? `${reviewee.first_name} ${reviewee.last_name}` : 'The employee'} acknowledged your review`,
        data: { href: '/hr?tab=performance', review_id: id },
      });
    }

    return this.findById(id);
  }

  async contributions(
    companyId: string,
    userId: string,
    filters: { date_from?: string; date_to?: string } = {},
  ) {
    const q = this.knex('issues as i')
      .where('i.assignee_id', userId)
      .join('projects as p', 'i.project_id', 'p.id')
      .where('p.company_id', companyId)
      .leftJoin('sprints as s', 'i.sprint_id', 's.id')
      .select(
        'i.id', 'i.title', 'i.status', 'i.type', 'i.priority',
        'i.story_points', 'i.due_date', 'i.created_at', 'i.updated_at',
        'p.name as project_name', 'p.icon as project_icon',
        's.name as sprint_name',
      )
      .orderBy('i.updated_at', 'desc');

    if (filters.date_from) q.where('i.created_at', '>=', filters.date_from);
    if (filters.date_to)   q.where('i.created_at', '<=', filters.date_to + ' 23:59:59');

    const issues = await q;

    const summary = {
      total:                   issues.length,
      done:                    issues.filter((i) => i.status === 'done').length,
      in_progress:             issues.filter((i) => i.status === 'in_progress' || i.status === 'in_review').length,
      todo:                    issues.filter((i) => i.status === 'todo').length,
      backlog:                 issues.filter((i) => i.status === 'backlog').length,
      story_points_completed:  issues.filter((i) => i.status === 'done').reduce((s, i) => s + (i.story_points ?? 0), 0),
      story_points_total:      issues.reduce((s, i) => s + (i.story_points ?? 0), 0),
      by_type: issues.reduce<Record<string, number>>((acc, i) => { acc[i.type] = (acc[i.type] ?? 0) + 1; return acc; }, {}),
    };

    return { summary, issues };
  }

  remove(id: string) {
    return this.knex('performance_reviews').where({ id }).update({ deleted_at: new Date() });
  }
}
