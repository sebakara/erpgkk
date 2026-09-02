import { Injectable, Inject, ForbiddenException, Optional } from '@nestjs/common';
import { Knex } from 'knex';
import { v4 as uuid } from 'uuid';
import { KNEX_CONNECTION } from '../database/database.module';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { LeaveService } from '../hr/leave/leave.service';
import { IssuesService } from '../issues/issues.service';
import { canManageAllProjects, engineeringHeadIds } from '../common/access/engineering';
import { findMentionedUsers } from '../common/mentions';

const LEAVE_TYPES = ['annual', 'sick', 'emergency', 'unpaid', 'maternity', 'paternity'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ChatService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    @Optional() private readonly gateway: NotificationsGateway,
    @Optional() private readonly leaveService: LeaveService,
    @Optional() private readonly issuesService: IssuesService,
  ) {}

  async getMyConversations(userId: string, companyId: string) {
    const user = await this.knex('users').where('id', userId).first();
    await this.ensureProjectRooms(userId, companyId, user?.role);

    const directConvIds = await this.knex('chat_conversation_members')
      .where('user_id', userId)
      .pluck('conversation_id');

    const directConvs = directConvIds.length
      ? await this.knex('chat_conversations').whereIn('id', directConvIds).andWhere('type', 'direct')
      : [];

    const enrichedDirect = await Promise.all(
      directConvs.map(async (conv) => {
        const otherUser = await this.knex('chat_conversation_members as cm')
          .join('users as u', 'cm.user_id', 'u.id')
          .where('cm.conversation_id', conv.id)
          .andWhereNot('cm.user_id', userId)
          .select('u.id', 'u.first_name', 'u.last_name', 'u.avatar_url', 'u.job_title')
          .first();
        return { ...conv, other_user: otherUser, ...(await this.threadMeta(conv.id, userId)) };
      }),
    );

    let deptConvQuery = this.knex('chat_conversations as c')
      .join('departments as d', 'c.department_id', 'd.id')
      .where('c.company_id', companyId)
      .andWhere('c.type', 'department')
      .select('c.*', 'd.name as department_name');

    if (user?.role !== 'admin') {
      const managedIds = await this.knex('departments').where({ company_id: companyId, manager_id: userId }).pluck('id');
      const deptIds = [user?.department_id, ...managedIds].filter(Boolean);
      if (!deptIds.length) deptConvQuery = deptConvQuery.whereRaw('1=0');
      else deptConvQuery = deptConvQuery.whereIn('c.department_id', deptIds);
    }

    const deptConvs = await deptConvQuery;
    const enrichedDept = await Promise.all(
      deptConvs.map(async (conv) => ({ ...conv, ...(await this.threadMeta(conv.id, userId)) })),
    );

    const projectConvs = await this.accessibleProjectConversations(userId, companyId, user?.role);
    const enrichedProject = await Promise.all(
      projectConvs.map(async (conv) => ({ ...conv, ...(await this.threadMeta(conv.id, userId)) })),
    );

    const sortByLastMsg = (a: any, b: any) => {
      const at = a.last_message?.created_at ?? a.created_at;
      const bt = b.last_message?.created_at ?? b.created_at;
      return new Date(bt).getTime() - new Date(at).getTime();
    };

    return {
      direct: enrichedDirect.sort(sortByLastMsg),
      department: enrichedDept.sort(sortByLastMsg),
      project: enrichedProject.sort(sortByLastMsg),
    };
  }

  async getOrCreateDirect(userId: string, otherUserId: string, companyId: string) {
    const existing = await this.knex('chat_conversations as c')
      .join('chat_conversation_members as m1', 'c.id', 'm1.conversation_id')
      .join('chat_conversation_members as m2', 'c.id', 'm2.conversation_id')
      .where('c.company_id', companyId)
      .andWhere('c.type', 'direct')
      .andWhere('m1.user_id', userId)
      .andWhere('m2.user_id', otherUserId)
      .select('c.id')
      .first();

    if (existing) return existing;

    const id = uuid();
    await this.knex('chat_conversations').insert({ id, company_id: companyId, type: 'direct' });
    await this.knex('chat_conversation_members').insert([
      { conversation_id: id, user_id: userId },
      { conversation_id: id, user_id: otherUserId },
    ]);
    return { id };
  }

  async getOrCreateDepartment(deptId: string, companyId: string) {
    const existing = await this.knex('chat_conversations')
      .where({ company_id: companyId, type: 'department', department_id: deptId })
      .first();

    if (existing) return existing;

    const id = uuid();
    await this.knex('chat_conversations').insert({
      id, company_id: companyId, type: 'department', department_id: deptId,
    });
    return { id };
  }

  async getOrCreateProject(projectId: string, companyId: string) {
    const existing = await this.knex('chat_conversations')
      .where({ company_id: companyId, type: 'project', project_id: projectId })
      .first();

    if (existing) return existing;

    const id = uuid();
    await this.knex('chat_conversations').insert({
      id, company_id: companyId, type: 'project', project_id: projectId,
    });
    return { id };
  }

  async getMessages(convId: string, userId: string, departmentId: string | null, role: string) {
    await this.assertCanAccess(convId, userId, departmentId, role);
    return this.knex('chat_messages as m')
      .join('users as u', 'm.sender_id', 'u.id')
      .where('m.conversation_id', convId)
      .select(
        'm.id', 'm.conversation_id', 'm.content', 'm.created_at', 'm.sender_id', 'm.kind',
        'u.first_name', 'u.last_name', 'u.avatar_url',
      )
      .orderBy('m.created_at', 'asc')
      .limit(200);
  }

  async sendMessage(convId: string, senderId: string, content: string) {
    const sender = await this.knex('users').where({ id: senderId }).first();
    if (!sender) throw new ForbiddenException();
    await this.assertCanAccess(convId, senderId, sender.department_id, sender.role);

    const trimmed = (content ?? '').trim();
    if (!trimmed) throw new ForbiddenException('Message cannot be empty');

    const conv = await this.knex('chat_conversations').where('id', convId).first();
    const userMsg = await this.insertMessage(convId, senderId, trimmed, 'user');
    await this.broadcast(conv, userMsg);

    if (trimmed.startsWith('/')) {
      const reply = await this.runCommand(trimmed, sender, conv);
      const systemMsg = await this.insertMessage(convId, senderId, reply, 'system');
      await this.broadcast(conv, systemMsg);
      return systemMsg;
    }

    await this.notifyMentions(trimmed, sender, convId);
    return userMsg;
  }

  async markRead(convId: string, userId: string) {
    const msgIds = await this.knex('chat_messages')
      .where('conversation_id', convId)
      .andWhereNot('sender_id', userId)
      .pluck('id');

    if (!msgIds.length) return;

    await this.knex('chat_message_reads')
      .insert(msgIds.map((mid) => ({ message_id: mid, user_id: userId })))
      .onConflict(['message_id', 'user_id'])
      .ignore();
  }

  async getUnreadCount(userId: string, companyId: string) {
    const { direct, department, project } = await this.getMyConversations(userId, companyId);
    const count = [...direct, ...department, ...project].reduce(
      (sum, c) => sum + Number(c.unread_count ?? 0),
      0,
    );
    return { count };
  }

  getPresence() {
    return { userIds: this.gateway?.getOnlineUserIds() ?? [] };
  }

  getUsers(companyId: string) {
    return this.knex('users')
      .where({ company_id: companyId, is_active: true })
      .select('id', 'first_name', 'last_name', 'avatar_url', 'job_title', 'department_id');
  }

  getDepartments(companyId: string) {
    return this.knex('departments').where('company_id', companyId).select('id', 'name');
  }

  private async insertMessage(convId: string, senderId: string, content: string, kind: 'user' | 'system') {
    const id = uuid();
    await this.knex('chat_messages').insert({
      id, conversation_id: convId, sender_id: senderId, content, kind,
    });
    return this.knex('chat_messages as m')
      .join('users as u', 'm.sender_id', 'u.id')
      .where('m.id', id)
      .select(
        'm.id', 'm.conversation_id', 'm.content', 'm.created_at', 'm.sender_id', 'm.kind',
        'u.first_name', 'u.last_name', 'u.avatar_url',
      )
      .first();
  }

  private async broadcast(conv: any, msg: any) {
    const memberIds = await this.memberIds(conv);
    this.gateway?.emitToUsers(memberIds, 'chat:message', msg);
  }

  private async notifyMentions(content: string, sender: any, convId: string) {
    const users = await this.getUsers(sender.company_id);
    const mentioned = findMentionedUsers(content, users as any[], sender.id);
    const preview = content.length > 80 ? `${content.slice(0, 77)}…` : content;
    for (const u of mentioned) {
      await this.gateway?.notifyUser(u.id, {
        type: 'chat_mention',
        title: `${sender.first_name} ${sender.last_name} mentioned you`,
        body: preview,
        data: { href: `/chat?conv=${convId}`, convId },
      });
    }
  }

  private async runCommand(raw: string, sender: any, conv: any): Promise<string> {
    const [cmd, ...rest] = raw.slice(1).trim().split(/\s+/);
    const name = (cmd || '').toLowerCase();

    if (name === 'leave') {
      return this.handleLeaveCommand(rest, sender);
    }
    if (name === 'issue') {
      return this.handleIssueCommand(rest, sender, conv);
    }
    return `Unknown command \`/${name}\`. Try \`/leave\` or \`/issue\`.`;
  }

  private async handleLeaveCommand(args: string[], sender: any): Promise<string> {
    const usage = 'Usage: `/leave <type> <YYYY-MM-DD> <YYYY-MM-DD> [reason]` — types: annual, sick, emergency, unpaid, maternity, paternity.';
    const [type, start, end, ...reasonParts] = args;
    if (!type || !start || !end || !LEAVE_TYPES.includes(type.toLowerCase()) || !DATE_RE.test(start) || !DATE_RE.test(end)) {
      return usage;
    }
    if (new Date(end) < new Date(start)) return 'End date must be on or after the start date.';
    if (!this.leaveService) return 'Leave is not available right now.';
    try {
      const req = await this.leaveService.create(sender.company_id, sender.id, {
        type: type.toLowerCase(),
        start_date: start,
        end_date: end,
        reason: reasonParts.join(' ') || undefined,
      });
      return `Leave request submitted: **${req.type}** ${req.start_date} → ${req.end_date} (pending).`;
    } catch (err: any) {
      return `Could not create leave: ${err?.message ?? 'unknown error'}`;
    }
  }

  private async handleIssueCommand(args: string[], sender: any, conv: any): Promise<string> {
    const usage = 'Usage: `/issue <title>` — only works in a **project** room.';
    if (conv?.type !== 'project' || !conv.project_id) return usage;
    const title = args.join(' ').trim();
    if (!title) return usage;
    if (!this.issuesService) return 'Issues are not available right now.';
    try {
      const issue = await this.issuesService.create(conv.project_id, sender.id, { title, type: 'task' });
      return `Issue created: **${issue.title}** (${issue.status}). Open it from the project Issues tab.`;
    } catch (err: any) {
      return `Could not create issue: ${err?.message ?? 'unknown error'}`;
    }
  }

  private async assertCanAccess(convId: string, userId: string, departmentId: string | null, role: string) {
    const conv = await this.knex('chat_conversations').where('id', convId).first();
    if (!conv) throw new ForbiddenException();

    if (role === 'admin') return;

    if (conv.type === 'direct') {
      const member = await this.knex('chat_conversation_members')
        .where({ conversation_id: convId, user_id: userId })
        .first();
      if (!member) throw new ForbiddenException('You are not a member of this conversation');
      return;
    }

    if (conv.type === 'department') {
      const managedIds = await this.knex('departments').where('manager_id', userId).pluck('id');
      const allowed = [departmentId, ...managedIds].filter(Boolean);
      if (!allowed.includes(conv.department_id)) {
        throw new ForbiddenException('You do not belong to this department');
      }
      return;
    }

    if (conv.type === 'project') {
      const ok = await this.canAccessProject(userId, conv.project_id, role);
      if (!ok) throw new ForbiddenException('You are not on this project');
    }
  }

  private async canAccessProject(userId: string, projectId: string, role: string) {
    if (role === 'admin') return true;
    const member = await this.knex('project_members').where({ project_id: projectId, user_id: userId }).first();
    if (member) return true;
    const assigned = await this.knex('issues').where({ project_id: projectId, assignee_id: userId }).first();
    if (assigned) return true;
    const project = await this.knex('projects').where({ id: projectId }).first();
    if (!project) return false;
    if (await canManageAllProjects(this.knex, project.company_id, userId, role)) return true;
    if (!project.department_id) return false;
    const head = await this.knex('departments').where({ id: project.department_id, manager_id: userId }).first();
    return !!head;
  }

  private async accessibleProjectConversations(userId: string, companyId: string, role?: string) {
    const projects = await this.accessibleProjects(userId, companyId, role);
    return this.knex('chat_conversations as c')
      .join('projects as p', 'c.project_id', 'p.id')
      .where('c.company_id', companyId)
      .andWhere('c.type', 'project')
      .whereIn('c.project_id', projects.length ? projects.map((p) => p.id) : ['00000000-0000-0000-0000-000000000000'])
      .whereNull('p.deleted_at')
      .select('c.*', 'p.name as project_name', 'p.icon as project_icon');
  }

  private async accessibleProjects(userId: string, companyId: string, role?: string) {
    if (await canManageAllProjects(this.knex, companyId, userId, role)) {
      return this.knex('projects').where({ company_id: companyId }).whereNull('deleted_at').select('id');
    }
    const managedDepts = await this.knex('departments').where({ company_id: companyId, manager_id: userId }).pluck('id');
    return this.knex('projects as p')
      .where('p.company_id', companyId)
      .whereNull('p.deleted_at')
      .where((b) => {
        b.whereExists(
          this.knex('project_members as pm').whereRaw('pm.project_id = p.id').andWhere('pm.user_id', userId),
        ).orWhereExists(
          this.knex('issues as i').whereRaw('i.project_id = p.id').andWhere('i.assignee_id', userId),
        );
        if (managedDepts.length) b.orWhereIn('p.department_id', managedDepts);
      })
      .select('p.id');
  }

  private async ensureProjectRooms(userId: string, companyId: string, role?: string) {
    const projects = await this.accessibleProjects(userId, companyId, role);
    for (const p of projects) {
      await this.getOrCreateProject(p.id, companyId);
    }
  }

  private async memberIds(conv: any): Promise<string[]> {
    if (conv.type === 'direct') {
      return this.knex('chat_conversation_members').where('conversation_id', conv.id).pluck('user_id');
    }
    if (conv.type === 'department' && conv.department_id) {
      const ids = await this.knex('users').where({ department_id: conv.department_id, is_active: true }).pluck('id');
      const head = await this.knex('departments').where({ id: conv.department_id }).select('manager_id').first();
      const admins = await this.knex('users').where({ company_id: conv.company_id, role: 'admin', is_active: true }).pluck('id');
      return [...new Set([...ids, head?.manager_id, ...admins].filter(Boolean))];
    }
    if (conv.type === 'project' && conv.project_id) {
      const members = await this.knex('project_members').where('project_id', conv.project_id).pluck('user_id');
      const assignees = await this.knex('issues').where('project_id', conv.project_id).whereNotNull('assignee_id').pluck('assignee_id');
      const admins = await this.knex('users').where({ company_id: conv.company_id, role: 'admin', is_active: true }).pluck('id');
      const engHeads = await engineeringHeadIds(this.knex, conv.company_id);
      return [...new Set([...members, ...assignees, ...admins, ...engHeads])];
    }
    return [];
  }

  private async threadMeta(convId: string, userId: string) {
    const lastMsg = await this.knex('chat_messages')
      .where('conversation_id', convId)
      .orderBy('created_at', 'desc')
      .first();
    const unread = await this.knex('chat_messages as m')
      .where('m.conversation_id', convId)
      .andWhereNot('m.sender_id', userId)
      .whereNotExists(
        this.knex('chat_message_reads as r')
          .whereRaw('r.message_id = m.id')
          .andWhere('r.user_id', userId),
      )
      .count('m.id as c')
      .first();
    return { last_message: lastMsg, unread_count: Number((unread as any)?.c ?? 0) };
  }
}
