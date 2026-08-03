import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('admin','manager','employee','hr') NOT NULL DEFAULT 'employee'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('admin','manager','employee') NOT NULL DEFAULT 'employee'
  `);
}
