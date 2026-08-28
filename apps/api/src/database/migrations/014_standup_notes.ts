import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('standup_notes', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    t.uuid('author_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.uuid('subject_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.date('standup_date').notNullable();
    t.text('content').notNullable();
    t.timestamp('deleted_at').nullable();
    t.timestamps(true, true);

    t.unique(['author_id', 'subject_user_id', 'standup_date']);
    t.index(['author_id', 'standup_date', 'deleted_at']);
    t.index(['company_id', 'subject_user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('standup_notes');
}
