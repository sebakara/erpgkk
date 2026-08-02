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
        .leftJoin('users as mgr', 'u.reports_to', 'mgr.id')
        .select(
          'u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.job_title',
          'u.phone', 'u.avatar_url', 'u.role', 'u.created_at as hire_date',
          'd.name as department_name',
          this.knex.raw("CONCAT(mgr.first_name, ' ', mgr.last_name) as reports_to_name"),
        )
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
        .orderBy('performance_reviews.created_at', 'asc'),

      this.knex('issues as i')
        .where('i.assignee_id', userId)
        .whereBetween('i.created_at', [dateFrom, dateTo])
        .leftJoin('projects as p', 'i.project_id', 'p.id')
        .leftJoin('sprints as s', 'i.sprint_id', 's.id')
        .select(
          'i.id', 'i.title', 'i.status', 'i.priority',
          'i.created_at', 'i.due_date', 'i.updated_at',
          'p.name as project_name',
          's.name as sprint_name',
        )
        .orderBy('i.due_date', 'asc'),
    ]);

    const leaveSummary = leaveRequests.reduce<Record<string, { total: number; approved: number; rejected: number; pending: number; days: number }>>((acc, r) => {
      if (!acc[r.type]) acc[r.type] = { total: 0, approved: 0, rejected: 0, pending: 0, days: 0 };
      acc[r.type].total++;
      acc[r.type][r.status as 'approved' | 'rejected' | 'pending']++;
      if (r.status === 'approved') {
        const days = Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1;
        acc[r.type].days += days;
      }
      return acc;
    }, {});

    const taskStats = {
      todo: tasks.filter((t: any) => t.status === 'todo').length,
      in_progress: tasks.filter((t: any) => t.status === 'in_progress').length,
      done: tasks.filter((t: any) => t.status === 'done').length,
      total: tasks.length,
      overdue: tasks.filter((t: any) => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()).length,
    };

    const scoredReviews = performance.filter((p: any) => p.score != null);
    const avgScore = scoredReviews.length
      ? Math.round(scoredReviews.reduce((s: number, p: any) => s + p.score, 0) / scoredReviews.length)
      : null;

    // trend: positive if latest score > earliest score
    let scoreTrend: 'up' | 'down' | 'stable' | null = null;
    if (scoredReviews.length >= 2) {
      const diff = scoredReviews[scoredReviews.length - 1].score - scoredReviews[0].score;
      scoreTrend = diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable';
    }

    const totalLeaveDays = Object.values(leaveSummary).reduce((s, v) => s + v.days, 0);

    return {
      employee,
      leaveRequests,
      leaveSummary,
      totalLeaveDays,
      performance,
      avgScore,
      scoreTrend,
      tasks,
      taskStats,
      dateFrom,
      dateTo,
    };
  }

  async departmentReport(companyId: string, departmentId: string, dateFrom: string, dateTo: string) {
    const [department, employees] = await Promise.all([
      this.knex('departments as d')
        .where('d.id', departmentId)
        .leftJoin('users as mgr', 'd.manager_id', 'mgr.id')
        .select(
          'd.*',
          this.knex.raw("CONCAT(mgr.first_name, ' ', mgr.last_name) as manager_name"),
          'mgr.job_title as manager_job_title',
          'mgr.avatar_url as manager_avatar_url',
        )
        .first(),
      this.knex('users').where({ department_id: departmentId, company_id: companyId }).select(
        'id', 'first_name', 'last_name', 'email', 'job_title', 'avatar_url', 'created_at as hire_date',
      ),
    ]);

    const employeeIds = employees.map((e: any) => e.id);
    const newHires = employees.filter((e: any) => e.hire_date >= dateFrom && e.hire_date <= dateTo).length;

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
            .select('assignee_id', 'status', 'priority', 'due_date')
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

      const leaveByType = empLeave.reduce<Record<string, number>>((acc, l) => {
        if (l.status === 'approved') acc[l.type] = (acc[l.type] ?? 0) + Math.ceil((new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000) + 1;
        return acc;
      }, {});

      const scoredPerf = empPerf.filter((p) => p.score != null);
      const avgScore = scoredPerf.length
        ? Math.round(scoredPerf.reduce((s: number, p: any) => s + p.score, 0) / scoredPerf.length)
        : null;

      const tasksTotal = empTasks.length;
      const tasksDone = empTasks.filter((t) => t.status === 'done').length;
      const tasksOverdue = empTasks.filter((t) => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()).length;
      const completionRate = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : null;

      return {
        ...emp,
        leaveDays,
        leaveCount: empLeave.length,
        leaveByType,
        avgScore,
        tasksTotal,
        tasksDone,
        tasksOverdue,
        completionRate,
      };
    });

    const totalLeaveDays = enriched.reduce((s: number, e: any) => s + e.leaveDays, 0);
    const scoredEmps = enriched.filter((e: any) => e.avgScore !== null);
    const avgDeptScore = scoredEmps.length
      ? Math.round(scoredEmps.reduce((s: number, e: any) => s + e.avgScore, 0) / scoredEmps.length)
      : null;

    const topPerformers = [...enriched]
      .filter((e: any) => e.avgScore !== null)
      .sort((a: any, b: any) => b.avgScore - a.avgScore)
      .slice(0, 3);

    // performance distribution
    const perfDistribution = {
      excellent: scoredEmps.filter((e: any) => e.avgScore >= 80).length,
      good: scoredEmps.filter((e: any) => e.avgScore >= 60 && e.avgScore < 80).length,
      needsImprovement: scoredEmps.filter((e: any) => e.avgScore < 60).length,
    };

    const totalTasksDone = enriched.reduce((s: number, e: any) => s + e.tasksDone, 0);
    const totalTasksAll = enriched.reduce((s: number, e: any) => s + e.tasksTotal, 0);

    return {
      department,
      employees: enriched,
      totalLeaveDays,
      avgDeptScore,
      headcount: employees.length,
      newHires,
      topPerformers,
      perfDistribution,
      totalTasksDone,
      totalTasksAll,
      dateFrom,
      dateTo,
    };
  }
}
