import { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.alterTable('projects', (t) => {
    t.uuid('department_id').nullable().references('id').inTable('departments').onDelete('SET NULL').after('owner_id');
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('projects', (t) => {
    t.dropForeign(['department_id']);
    t.dropColumn('department_id');
  });
}
