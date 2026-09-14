import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('issue_assignees');
  if (exists) return;

  await knex.schema.createTable('issue_assignees', (t) => {
    t.uuid('id').primary();
    t.uuid('issue_id').notNullable().references('id').inTable('issues').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['issue_id', 'user_id'], 'issue_assignees_unique');
    t.index(['user_id'], 'issue_assignees_user_idx');
  });

  await knex.raw(`
    INSERT IGNORE INTO issue_assignees (id, issue_id, user_id, created_at)
    SELECT UUID(), id, assignee_id, NOW()
    FROM issues
    WHERE assignee_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('issue_assignees');
}
