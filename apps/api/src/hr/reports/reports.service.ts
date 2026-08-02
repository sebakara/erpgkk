import { Injectable, Inject } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';

@Injectable()
export class ReportsService {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async employeeReport(companyId: string, userId: string, dateFrom: string, dateTo: string) {
    const [employee, leaveRequests, performance, tasks] = await Promise.all([
      this.knex('users as u')
        .where('u.id', userId)
        .leftJoin('departments as d', 'u.department_id', 'd.id')
        .select('u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.job_title',
          'u.phone', 'u.avatar_url', 'd.name as department_name')
        .first(),

      this.knex('leave_requests')
        .where({ user_id: userId, company_id: companyId })
        .whereBetween('start_date', [dateFrom, dateTo])
        .orderBy('start_date', 'desc'),

      this.knex('performance_reviews')
        .where({ reviewee_id: userId, company_id: companyId })
        .whereBetween('created_at', [dateFrom, dateTo])
        .leftJoin('users as r', 'performance_reviews.reviewer_id', 'r.id')
        .select(
          'performance_reviews.*',
          this.knex.raw("CONCAT(r.first_name, ' ', r.last_name) as reviewer_name"),
        )
        .orderBy('performance_reviews.created_at', 'desc'),

      this.knex('issues as i')
        .where('i.assignee_id', userId)
        .whereBetween('i.created_at', [dateFrom, dateTo])
        .leftJoin('projects as p', 'i.project_id', 'p.id')
        .select('i.id', 'i.title', 'i.status', 'i.priority', 'i.created_at', 'p.name as project_name')
        .orderBy('i.created_at', 'desc'),
    ]);

    const leaveSummary = leaveRequests.reduce<Record<string, { total: number; approved: number; days: number }>>((acc, r) => {
      if (!acc[r.type]) acc[r.type] = { total: 0, approved: 0, days: 0 };
      acc[r.type].total++;
      if (r.status === 'approved') {
        acc[r.type].approved++;
        const days = Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1;
        acc[r.type].days += days;
      }
      return acc;
    }, {});

    const avgScore = performance.length
      ? Math.round(performance.filter((p: any) => p.score).reduce((s: number, p: any) => s + p.score, 0) / performance.filter((p: any) => p.score).length)
      : null;

    return { employee, leaveRequests, leaveSummary, performance, avgScore, tasks, dateFrom, dateTo };
  }

  async departmentReport(companyId: string, departmentId: string, dateFrom: string, dateTo: string) {
    const [department, employees] = await Promise.all([
      this.knex('departments').where('id', departmentId).first(),
      this.knex('users').where({ department_id: departmentId, company_id: companyId }).select(
        'id', 'first_name', 'last_name', 'email', 'job_title', 'avatar_url',
      ),
    ]);

    const employeeIds = employees.map((e: any) => e.id);

    const [leaveRequests, performance, tasks] = await Promise.all([
      employeeIds.length
        ? this.knex('leave_requests')
            .whereIn('user_id', employeeIds)
            .where('company_id', companyId)
            .whereBetween('start_date', [dateFrom, dateTo])
        : [],
      employeeIds.length
        ? this.knex('performance_reviews')
            .whereIn('reviewee_id', employeeIds)
            .where('company_id', companyId)
            .whereBetween('created_at', [dateFrom, dateTo])
        : [],
      employeeIds.length
        ? this.knex('issues')
            .whereIn('assignee_id', employeeIds)
            .whereBetween('created_at', [dateFrom, dateTo])
            .select('assignee_id', 'status')
        : [],
    ]);

    const enriched = employees.map((emp: any) => {
      const empLeave = (leaveRequests as any[]).filter((l) => l.user_id === emp.id);
      const empPerf = (performance as any[]).filter((p) => p.reviewee_id === emp.id);
      const empTasks = (tasks as any[]).filter((t) => t.assignee_id === emp.id);
      const leaveDays = empLeave
        .filter((l) => l.status === 'approved')
        .reduce((sum: number, l: any) => {
          return sum + Math.ceil((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1;
        }, 0);
      const avgScore = empPerf.filter((p) => p.score).length
        ? Math.round(empPerf.filter((p) => p.score).reduce((s: number, p: any) => s + p.score, 0) / empPerf.filter((p) => p.score).length)
        : null;
      return {
        ...emp,
        leaveDays,
        leaveCount: empLeave.length,
        avgScore,
        tasksTotal: empTasks.length,
        tasksDone: empTasks.filter((t) => t.status === 'done').length,
      };
    });

    const totalLeaveDays = enriched.reduce((s: number, e: any) => s + e.leaveDays, 0);
    const avgDeptScore = enriched.filter((e: any) => e.avgScore).length
      ? Math.round(enriched.filter((e: any) => e.avgScore).reduce((s: number, e: any) => s + e.avgScore, 0) / enriched.filter((e: any) => e.avgScore).length)
      : null;

    return { department, employees: enriched, totalLeaveDays, avgDeptScore, headcount: employees.length, dateFrom, dateTo };
  }
}
