import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('github_pr_links');
  if (exists) return;

  await knex.schema.createTable('github_pr_links', (t) => {
    t.uuid('id').primary();
    t.uuid('issue_id').notNullable().references('id').inTable('issues').onDelete('CASCADE');
    t.uuid('pull_request_id').notNullable().references('id').inTable('github_pull_requests').onDelete('CASCADE');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['issue_id', 'pull_request_id'], 'github_pr_links_unique');
    t.index(['pull_request_id'], 'github_pr_links_pr_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('github_pr_links');
}
