import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('admin','manager','employee','hr','project_manager') NOT NULL DEFAULT 'employee'
  `);
  await knex.raw(`
    ALTER TABLE project_members
    MODIFY COLUMN role ENUM('owner','manager','member','viewer') NOT NULL DEFAULT 'member'
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE project_members SET role = 'member' WHERE role = 'manager'
  `);
  await knex.raw(`
    ALTER TABLE project_members
    MODIFY COLUMN role ENUM('owner','member','viewer') NOT NULL DEFAULT 'member'
  `);
  await knex.raw(`
    UPDATE users SET role = 'manager' WHERE role = 'project_manager'
  `);
  await knex.raw(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('admin','manager','employee','hr') NOT NULL DEFAULT 'employee'
  `);
}
