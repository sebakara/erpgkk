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

/** Production may have recorded 009 without adding projects.deleted_at. */
export async function up(knex: Knex): Promise<void> {
  for (const table of TABLES) {
    const hasTable = await knex.schema.hasTable(table);
    if (!hasTable) continue;
    const has = await knex.schema.hasColumn(table, 'deleted_at');
    if (!has) {
      await knex.schema.alterTable(table, (t) => {
        t.timestamp('deleted_at').nullable().defaultTo(null);
      });
    }
  }
}

export async function down(): Promise<void> {
  // Keep columns; 009 owns the original drop.
}
