import type { Knex } from 'knex';

async function indexNames(knex: Knex, table: string): Promise<Set<string>> {
  const [rows] = await knex.raw(`SHOW INDEX FROM ??`, [table]);
  return new Set((rows as Array<{ Key_name: string }>).map((row) => row.Key_name));
}

async function companyForeignKeys(knex: Knex): Promise<string[]> {
  const [rows] = await knex.raw(
    `SELECT CONSTRAINT_NAME AS name
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'github_installations'
       AND COLUMN_NAME = 'company_id'
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );
  return (rows as Array<{ name: string }>).map((row) => row.name);
}

async function ensureCompanyIndex(knex: Knex, names: Set<string>) {
  if (names.has('gh_installations_company_idx')) return;
  await knex.schema.alterTable('github_installations', (t) => {
    t.index(['company_id'], 'gh_installations_company_idx');
  });
}

async function dropCompanyUnique(knex: Knex, names: Set<string>) {
  const unique = names.has('gh_installations_company_unique')
    ? 'gh_installations_company_unique'
    : names.has('github_installations_company_id_unique')
      ? 'github_installations_company_id_unique'
      : null;
  if (!unique) return;

  try {
    await knex.raw('ALTER TABLE `github_installations` DROP INDEX ??', [unique]);
  } catch (err: any) {
    if (err?.code !== 'ER_DROP_INDEX_FK') throw err;
    const fks = await companyForeignKeys(knex);
    for (const name of fks) {
      await knex.raw('ALTER TABLE `github_installations` DROP FOREIGN KEY ??', [name]);
    }
    await knex.raw('ALTER TABLE `github_installations` DROP INDEX ??', [unique]);
    await knex.raw(`
      ALTER TABLE \`github_installations\`
      ADD CONSTRAINT \`github_installations_company_id_foreign\`
      FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE CASCADE
    `);
  }
}

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('github_installations'))) return;

  // MySQL will not drop the unique index while a foreign key still uses it.
  // Add a non-unique index first so the FK can switch, then drop unique.
  await ensureCompanyIndex(knex, await indexNames(knex, 'github_installations'));
  await dropCompanyUnique(knex, await indexNames(knex, 'github_installations'));
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('github_installations'))) return;

  const names = await indexNames(knex, 'github_installations');
  if (!names.has('gh_installations_company_unique')) {
    await knex.schema.alterTable('github_installations', (t) => {
      t.unique(['company_id'], 'gh_installations_company_unique');
    });
  }

  const after = await indexNames(knex, 'github_installations');
  if (after.has('gh_installations_company_idx')) {
    await knex.raw('ALTER TABLE `github_installations` DROP INDEX `gh_installations_company_idx`');
  }
}
