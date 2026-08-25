import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE chat_conversations
    MODIFY COLUMN type ENUM('direct', 'department', 'project') NOT NULL
  `);

  await knex.schema.alterTable('chat_conversations', (t) => {
    t.uuid('project_id').nullable();
  });

  await knex.schema.alterTable('chat_conversations', (t) => {
    t.foreign('project_id').references('id').inTable('projects').onDelete('CASCADE');
    t.index(['project_id']);
  });

  await knex.schema.alterTable('chat_messages', (t) => {
    t.string('kind', 20).notNullable().defaultTo('user');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chat_messages', (t) => {
    t.dropColumn('kind');
  });

  await knex.schema.alterTable('chat_conversations', (t) => {
    t.dropForeign(['project_id']);
    t.dropColumn('project_id');
  });

  await knex.raw(`
    ALTER TABLE chat_conversations
    MODIFY COLUMN type ENUM('direct', 'department') NOT NULL
  `);
}
