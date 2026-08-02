import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('project_files', (t) => {
    t.uuid('id').primary();
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.string('original_name', 255).notNullable();
    t.string('stored_name', 255).notNullable();
    t.text('url').notNullable();
    t.integer('size').notNullable();
    t.string('mime_type', 100).notNullable();
    t.uuid('uploaded_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_files');
}
