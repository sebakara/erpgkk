import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('github_installations', (t) => {
    t.dropUnique(['company_id'], 'gh_installations_company_unique');
  });
  await knex.schema.alterTable('github_installations', (t) => {
    t.index(['company_id'], 'gh_installations_company_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('github_installations', (t) => {
    t.dropIndex(['company_id'], 'gh_installations_company_idx');
  });
  await knex.schema.alterTable('github_installations', (t) => {
    t.unique(['company_id'], 'gh_installations_company_unique');
  });
}
