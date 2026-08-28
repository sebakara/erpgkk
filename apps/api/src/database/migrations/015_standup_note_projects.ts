import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('standup_note_projects', (t) => {
    t.uuid('standup_note_id')
      .notNullable()
      .references('id')
      .inTable('standup_notes')
      .onDelete('CASCADE');
    t.uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    t.primary(['standup_note_id', 'project_id']);
    t.index(['project_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('standup_note_projects');
}
