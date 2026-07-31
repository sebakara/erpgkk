import { Knex } from 'knex';

export async function up(knex: Knex) {
  await knex.schema.alterTable('users', (t) => {
    t.uuid('reports_to').nullable().references('id').inTable('users').onDelete('SET NULL').after('department_id');
  });
}

export async function down(knex: Knex) {
  await knex.schema.alterTable('users', (t) => {
    t.dropForeign(['reports_to']);
    t.dropColumn('reports_to');
  });
}
