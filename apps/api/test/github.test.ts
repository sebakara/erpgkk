import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createHmac } from 'crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as dotenv from 'dotenv';
import knex, { Knex } from 'knex';
import { resolve } from 'path';
import { v4 as uuid } from 'uuid';
import { Role } from '../src/common/enums';
import { verifyGitHubSignature } from '../src/integrations/github-webhooks/verify';
import { claimDelivery } from '../src/integrations/github-webhooks/process';
import { mapIssue, mapPullRequest, mapRepository } from '../src/integrations/github-mappers';
import { GitHubService } from '../src/integrations/github.service';

dotenv.config({ path: resolve(__dirname, '../.env') });

function signedBody(secret: string, payload: string) {
  return {
    raw: Buffer.from(payload),
    signature: 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex'),
  };
}

test('GitHub webhook signatures reject tampered or missing HMAC', () => {
  const secret = 'webhook-secret';
  const { raw, signature } = signedBody(secret, '{"ok":true}');
  assert.equal(verifyGitHubSignature(raw, signature, secret), true);
  assert.equal(verifyGitHubSignature(raw, signature, 'other'), false);
  assert.equal(verifyGitHubSignature(raw, 'sha256=deadbeef', secret), false);
  assert.equal(verifyGitHubSignature(raw, undefined, secret), false);
  assert.equal(verifyGitHubSignature(raw, signature, ''), false);
});

test('mappers keep GitHub numeric ids as strings and skip PR-shaped issues', () => {
  const repo = mapRepository({
    id: 99,
    name: 'ops',
    full_name: 'gkk/ops',
    owner: { login: 'gkk' },
    html_url: 'https://github.com/gkk/ops',
    private: true,
  });
  assert.equal(repo.github_repository_id, '99');
  assert.equal(repo.owner, 'gkk');

  const pr = mapPullRequest({
    id: 12,
    number: 3,
    title: 'Fix login',
    user: { id: 7, login: 'maic' },
    state: 'open',
    merged: false,
    html_url: 'https://github.com/gkk/ops/pull/3',
    head: { ref: 'fix' },
    base: { ref: 'main' },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  });
  assert.equal(pr.github_pr_id, '12');
  assert.equal(pr.author_login, 'maic');
  assert.equal(pr.source_branch, 'fix');

  const issue = mapIssue({
    id: 5,
    number: 8,
    title: 'Bug',
    state: 'open',
    user: { id: 1, login: 'dev' },
    pull_request: { url: 'https://api.github.com/repos/gkk/ops/pulls/8' },
  });
  assert.equal(issue.is_pull_request, true);
});

function createDatabase() {
  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'gkkerp',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
    },
  });
}

test('webhook deliveries are claimed once and GitHub mapping respects RBAC', async () => {
  const database = createDatabase();
  const hasTable = await database.schema.hasTable('github_webhook_events');
  if (!hasTable) {
    await database.destroy();
    throw new Error('github_webhook_events is missing — run API migrations first');
  }

  const transaction = await database.transaction();
  const ids = {
    company: uuid(),
    otherCompany: uuid(),
    admin: uuid(),
    manager: uuid(),
    employee: uuid(),
    hr: uuid(),
    outsider: uuid(),
    project: uuid(),
    otherProject: uuid(),
  };

  try {
    await transaction('companies').insert([
      { id: ids.company, name: 'GitHub Test Co', slug: `gh-${uuid()}` },
      { id: ids.otherCompany, name: 'Other Co', slug: `gh-o-${uuid()}` },
    ]);
    const passwordHash = 'integration-test-only';
    await transaction('users').insert([
      userRow(ids.admin, ids.company, Role.Admin, 'Admin'),
      userRow(ids.manager, ids.company, Role.Manager, 'Manager'),
      userRow(ids.employee, ids.company, Role.Employee, 'Dev'),
      userRow(ids.hr, ids.company, Role.Hr, 'Hr'),
      userRow(ids.outsider, ids.otherCompany, Role.Employee, 'Out'),
    ]);
    await transaction('projects').insert({
      id: ids.project,
      company_id: ids.company,
      owner_id: ids.employee,
      name: 'Ops',
    });
    await transaction('project_members').insert({
      id: uuid(),
      project_id: ids.project,
      user_id: ids.employee,
      role: 'owner',
    });

    const first = await claimDelivery(transaction, 'delivery-1', 'push', undefined, '11', '22');
    const again = await claimDelivery(transaction, 'delivery-1', 'push', undefined, '11', '22');
    assert.equal(first, 'claimed');
    assert.equal(again, 'duplicate');

    const prId = uuid();
    const installationId = uuid();
    const repoId = uuid();
    await transaction('github_installations').insert({
      id: installationId,
      company_id: ids.company,
      github_installation_id: 1001,
      github_account_id: 2002,
      github_account_login: 'gkk-test',
      account_type: 'Organization',
      repository_selection: 'selected',
      status: 'active',
      installed_at: new Date(),
    });
    await transaction('github_repositories').insert({
      id: repoId,
      installation_id: installationId,
      github_repository_id: 3003,
      owner: 'gkk-test',
      name: 'ops',
      full_name: 'gkk-test/ops',
      private: true,
      archived: false,
      html_url: 'https://github.com/gkk-test/ops',
    });

    const existing = await transaction('github_pull_requests').where({ github_repository_id: repoId, github_pr_id: 44 }).first();
    assert.equal(existing, undefined);
    await transaction('github_pull_requests').insert({
      id: prId,
      github_repository_id: repoId,
      github_pr_id: 44,
      number: 1,
      title: 'First',
      state: 'open',
      draft: false,
      merged: false,
    });
    await transaction('github_pull_requests').where({ id: prId }).update({ title: 'Updated' });
    const upserted = await transaction('github_pull_requests').where({ github_repository_id: repoId, github_pr_id: 44 }).first();
    assert.equal(upserted.title, 'Updated');

    const github = new GitHubService(transaction as unknown as Knex, {} as any, {} as any);

    await github.assertCanViewProject(ids.project, { id: ids.employee, company_id: ids.company, role: Role.Employee });
    await github.assertCanManageProject(ids.project, { id: ids.employee, company_id: ids.company, role: Role.Employee });
    await github.assertCanManageProject(ids.project, { id: ids.admin, company_id: ids.company, role: Role.Admin });

    await assert.rejects(
      () => github.assertCanManageProject(ids.project, { id: ids.hr, company_id: ids.company, role: Role.Hr }),
      ForbiddenException,
    );
    await assert.rejects(
      () => github.assertCanViewProject(ids.project, { id: ids.outsider, company_id: ids.otherCompany, role: Role.Employee }),
      NotFoundException,
    );
  } finally {
    await transaction.rollback();
    await database.destroy();
  }
});

function userRow(id: string, companyId: string, role: Role, first: string) {
  return {
    id,
    company_id: companyId,
    email: `${first.toLowerCase()}-${uuid()}@example.test`,
    password_hash: 'integration-test-only',
    first_name: first,
    last_name: 'Tester',
    role,
    is_active: true,
  };
}
