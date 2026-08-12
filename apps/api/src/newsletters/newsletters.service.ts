import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { v4 as uuid } from 'uuid';
import { MailService } from '../common/services/mail.service';

@Injectable()
export class NewslettersService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private readonly mail: MailService,
  ) {}

  findAll(companyId: string) {
    return this.knex('newsletters as n')
      .where('n.company_id', companyId)
      .whereNull('n.deleted_at')
      .join('users as u', 'n.author_id', 'u.id')
      .select(
        'n.id', 'n.subject', 'n.status', 'n.sent_at', 'n.recipient_count',
        'n.created_at', 'n.updated_at',
        this.knex.raw("CONCAT(u.first_name, ' ', u.last_name) as author_name"),
      )
      .orderBy('n.updated_at', 'desc');
  }

  async findById(id: string, companyId: string) {
    const nl = await this.knex('newsletters').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!nl) throw new NotFoundException('Newsletter not found');
    return nl;
  }

  async create(companyId: string, authorId: string, data: { subject: string; content?: string }) {
    const id = uuid();
    await this.knex('newsletters').insert({ id, company_id: companyId, author_id: authorId, ...data });
    return this.knex('newsletters').where({ id }).first();
  }

  async update(id: string, companyId: string, data: { subject?: string; content?: string }) {
    const nl = await this.knex('newsletters').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!nl) throw new NotFoundException('Newsletter not found');
    if (nl.status === 'sent') throw new BadRequestException('Cannot edit a sent newsletter');
    await this.knex('newsletters').where({ id }).update({ ...data, updated_at: new Date() });
    return this.knex('newsletters').where({ id }).first();
  }

  remove(id: string, companyId: string) {
    return this.knex('newsletters').where({ id, company_id: companyId }).update({ deleted_at: new Date() });
  }

  async send(id: string, companyId: string, recipients: Array<{ email: string; name?: string }>) {
    const nl = await this.knex('newsletters').where({ id, company_id: companyId }).whereNull('deleted_at').first();
    if (!nl) throw new NotFoundException('Newsletter not found');
    if (nl.status === 'sent') throw new BadRequestException('Already sent');
    if (!recipients.length) throw new BadRequestException('No recipients provided');

    // Deduplicate by email
    const unique = Array.from(new Map(recipients.map((r) => [r.email.toLowerCase(), r])).values());

    let successCount = 0;
    for (const r of unique) {
      const sendId = uuid();
      try {
        await this.mail.sendNewsletter({ to: r.email, name: r.name, subject: nl.subject, content: nl.content || '' });
        await this.knex('newsletter_sends').insert({ id: sendId, newsletter_id: id, email: r.email, name: r.name || null, sent_at: new Date() });
        successCount++;
      } catch (err: any) {
        await this.knex('newsletter_sends').insert({ id: sendId, newsletter_id: id, email: r.email, name: r.name || null, error: err.message });
      }
    }

    await this.knex('newsletters').where({ id }).update({
      status: 'sent',
      sent_at: new Date(),
      recipient_count: successCount,
      updated_at: new Date(),
    });

    return { sent: successCount, total: unique.length };
  }

  getSends(newsletterId: string) {
    return this.knex('newsletter_sends').where({ newsletter_id: newsletterId }).orderBy('created_at', 'desc');
  }
}
