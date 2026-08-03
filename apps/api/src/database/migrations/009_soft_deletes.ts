import type { Knex } from 'knex';

const TABLES = [
  'departments',
  'docs',
  'project_files',
  'announcements',
  'leave_packages',
  'performance_reviews',
  'issues',
  'projects',
  'sprints',
];

export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const has = await knex.schema.hasColumn(table, 'deleted_at');
    if (!has) {
      await knex.schema.alterTable(table, (t) => {
        t.timestamp('deleted_at').nullable().defaultTo(null);
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('deleted_at');
    });
  }
}
