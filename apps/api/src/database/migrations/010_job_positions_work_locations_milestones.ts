import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('job_positions', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').nullable().references('id').inTable('companies').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description').nullable();
    t.text('requirements').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('work_locations', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').nullable().references('id').inTable('companies').onDelete('CASCADE');
    t.string('name').notNullable();
    t.enum('type', ['home', 'office', 'other']).notNullable().defaultTo('office');
    t.string('address').nullable();
    t.timestamps(true, true);
  });

  await knex.schema.createTable('milestones', (t) => {
    t.uuid('id').primary();
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description').nullable();
    t.date('deadline').nullable();
    t.boolean('is_done').notNullable().defaultTo(false);
    t.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('milestones');
  await knex.schema.dropTableIfExists('work_locations');
  await knex.schema.dropTableIfExists('job_positions');
}
