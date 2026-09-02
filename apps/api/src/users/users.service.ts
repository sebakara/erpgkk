import { Injectable, Inject, NotFoundException, ConflictException, BadRequestException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { MailService } from '../common/services/mail.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { ensureManagementDepartment } from '../common/access/management';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class UsersService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    @Optional() private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async findById(id: string) {
    return this.knex('users as u')
      .where('u.id', id)
      .leftJoin('departments as d', 'u.department_id', 'd.id')
      .leftJoin('users as m', 'u.reports_to', 'm.id')
      .select(
        'u.*',
        'd.name as department_name',
        this.knex.raw("CONCAT(m.first_name, ' ', m.last_name) as reports_to_name"),
        'm.job_title as reports_to_job_title',
        'm.avatar_url as reports_to_avatar',
        'u.id',
        'u.company_id',
        'u.role',
        'u.job_title',
      )
      .first();
  }

  async findByEmail(email: string) {
    return this.knex('users').where({ email }).first();
  }

  async findByCompany(companyId: string, callerId?: string, callerRole?: string) {
    const q = this.knex('users as u')
      .where('u.company_id', companyId)
      .leftJoin('departments as d', 'u.department_id', 'd.id')
      .leftJoin('users as m', 'u.reports_to', 'm.id')
      .select(
        'u.id', 'u.email', 'u.first_name', 'u.last_name', 'u.role',
        'u.job_title', 'u.avatar_url', 'u.department_id', 'u.reports_to',
        'u.is_active', 'u.onboarding_completed', 'u.created_at',
        'd.name as department_name',
        this.knex.raw("CONCAT(m.first_name, ' ', m.last_name) as reports_to_name"),
        'm.job_title as reports_to_job_title',
        'm.avatar_url as reports_to_avatar',
      )
      .orderBy('u.first_name');

    if (!callerId || callerRole === 'admin' || callerRole === 'manager' || callerRole === 'hr') return q;

    // Check if the caller is a dept head
    const managedDepts = await this.knex('departments')
      .where({ company_id: companyId, manager_id: callerId })
      .pluck('id');

    if (managedDepts.length > 0) {
      // Dept head: see everyone in their department(s)
      return q.whereIn('u.department_id', managedDepts);
    }

    // Regular employee: only themselves
    return q.where('u.id', callerId);
  }

  async update(id: string, data: Partial<{
    first_name: string; last_name: string; job_title: string;
    avatar_url: string; department_id: string; reports_to: string; role: string; is_active: boolean;
  }>) {
    const user = await this.knex('users').where({ id }).first();
    if (!user) throw new NotFoundException('User not found');

    const nextRole = data.role ?? user.role;
    const patch: Record<string, unknown> = { ...data, updated_at: new Date() };
    if (nextRole === 'manager') {
      patch.department_id = await ensureManagementDepartment(this.knex, user.company_id);
    }

    await this.knex('users').where({ id }).update(patch);

    if (data.role && data.role !== user.role) {
      await this.notificationsGateway?.notifyUser(id, {
        type: 'role_changed',
        title: 'Your role was updated',
        body: `You are now a ${nextRole}`,
        data: { href: '/profile', role: nextRole },
      });
    } else if (
      patch.department_id
      && patch.department_id !== user.department_id
      && nextRole !== 'manager'
    ) {
      const dept = await this.knex('departments').where({ id: patch.department_id }).first('name');
      await this.notificationsGateway?.notifyUser(id, {
        type: 'department_changed',
        title: 'Your department was updated',
        body: dept?.name ? `You were moved to ${dept.name}` : 'Your department assignment changed',
        data: { href: '/profile', department_id: patch.department_id },
      });
    }

    return this.findById(id);
  }

  // HR creates a placeholder user and sends invite email
  async createEmployee(companyId: string, data: {
    email: string;
    first_name: string;
    last_name: string;
    role?: string;
    job_title?: string;
    department_id?: string;
  }) {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('Email already in use');

    const company = await this.knex('companies').where({ id: companyId }).first();

    const role = data.role ?? 'employee';
    let department_id = data.department_id || null;
    if (role === 'manager') {
      department_id = await ensureManagementDepartment(this.knex, companyId);
    }

    // Look up the dept head to set as the reporting manager
    let reports_to: string | null = null;
    if (department_id) {
      const dept = await this.knex('departments').where({ id: department_id }).first();
      reports_to = dept?.manager_id ?? null;
    }

    const id = uuid();
    // Placeholder password — employee sets their own during onboarding
    const password_hash = await bcrypt.hash(uuid(), 10);

    await this.knex('users').insert({
      id,
      company_id: companyId,
      email: data.email,
      password_hash,
      first_name: data.first_name,
      last_name: data.last_name,
      role,
      job_title: data.job_title ?? null,
      department_id,
      reports_to,
      is_active: false,
      onboarding_completed: false,
    });

    // Create invite token (valid 7 days)
    const token = crypto.randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.knex('invites').insert({ id: uuid(), user_id: id, token, expires_at });

    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const inviteUrl = `${frontendUrl}/onboarding?token=${token}`;

    await this.mail.sendInvite({
      to: data.email,
      name: `${data.first_name} ${data.last_name}`,
      companyName: company?.name ?? 'Your Company',
      inviteUrl,
    });

    return this.findByCompany(companyId).then((list) => list.find((u: any) => u.id === id));
  }

  // Validate an invite token and return the pre-filled user info
  async getInvite(token: string) {
    const invite = await this.knex('invites').where({ token, used: false }).first();
    if (!invite) throw new BadRequestException('Invalid or expired invite link');
    if (new Date(invite.expires_at) < new Date()) throw new BadRequestException('Invite link has expired');

    const user = await this.knex('users as u')
      .where('u.id', invite.user_id)
      .join('companies as c', 'u.company_id', 'c.id')
      .select('u.id', 'u.first_name', 'u.last_name', 'u.email', 'c.name as company_name')
      .first();

    return { ...user, token };
  }

  // Employee completes onboarding
  async completeOnboarding(token: string, data: {
    password: string;
    nid: string;
    phone: string;
    address: string;
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    passport_url?: string;
    nid_url?: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relation: string;
  }) {
    const invite = await this.knex('invites').where({ token, used: false }).first();
    if (!invite) throw new BadRequestException('Invalid or expired invite link');
    if (new Date(invite.expires_at) < new Date()) throw new BadRequestException('Invite link has expired');

    const password_hash = await bcrypt.hash(data.password, 10);
    const { password, ...rest } = data;

    await this.knex('users').where({ id: invite.user_id }).update({
      password_hash,
      ...rest,
      is_active: true,
      onboarding_completed: true,
      updated_at: new Date(),
    });

    await this.knex('invites').where({ id: invite.id }).update({ used: true });

    return { success: true };
  }

  async remove(id: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    await this.knex('users').where({ id }).update({ is_active: false, updated_at: new Date() });
  }
}
