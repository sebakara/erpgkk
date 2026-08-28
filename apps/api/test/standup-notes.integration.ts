import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as dotenv from 'dotenv';
import knex, { Knex } from 'knex';
import { resolve } from 'path';
import { v4 as uuid } from 'uuid';
import { Role } from '../src/common/enums';
import { StandupNotesService } from '../src/hr/standup-notes/standup-notes.service';

dotenv.config({ path: resolve(__dirname, '../.env') });

function createDatabase() {
  return knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'gkkerp',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      ...(process.env.DB_SOCKET ? { socketPath: process.env.DB_SOCKET } : {}),
    },
  });
}

test('standup notes remain private to their author and respect manager scope', async () => {
  const database = createDatabase();
  const transaction = await database.transaction();

  try {
    const ids = {
      company: uuid(),
      otherCompany: uuid(),
      managedDepartment: uuid(),
      otherDepartment: uuid(),
      outsideDepartment: uuid(),
      admin: uuid(),
      otherAdmin: uuid(),
      manager: uuid(),
      otherManager: uuid(),
      developer: uuid(),
      outsideDeveloper: uuid(),
      managedProject: uuid(),
      otherProject: uuid(),
      outsideProject: uuid(),
    };

    await transaction('companies').insert([
      { id: ids.company, name: 'Standup Test Company', slug: `standup-${uuid()}` },
      { id: ids.otherCompany, name: 'Outside Company', slug: `outside-${uuid()}` },
    ]);
    await transaction('departments').insert([
      { id: ids.managedDepartment, company_id: ids.company, name: 'Engineering' },
      { id: ids.otherDepartment, company_id: ids.company, name: 'Product' },
      { id: ids.outsideDepartment, company_id: ids.otherCompany, name: 'Outside' },
    ]);

    const passwordHash = 'integration-test-only';
    await transaction('users').insert([
      {
        id: ids.admin,
        company_id: ids.company,
        email: `admin-${uuid()}@example.test`,
        password_hash: passwordHash,
        first_name: 'Admin',
        last_name: 'Author',
        role: Role.Admin,
        is_active: true,
      },
      {
        id: ids.otherAdmin,
        company_id: ids.company,
        email: `admin-${uuid()}@example.test`,
        password_hash: passwordHash,
        first_name: 'Other',
        last_name: 'Admin',
        role: Role.Admin,
        is_active: true,
      },
      {
        id: ids.manager,
        company_id: ids.company,
        department_id: ids.managedDepartment,
        email: `manager-${uuid()}@example.test`,
        password_hash: passwordHash,
        first_name: 'Managing',
        last_name: 'Lead',
        role: Role.Manager,
        is_active: true,
      },
      {
        id: ids.otherManager,
        company_id: ids.company,
        department_id: ids.otherDepartment,
        email: `manager-${uuid()}@example.test`,
        password_hash: passwordHash,
        first_name: 'Other',
        last_name: 'Lead',
        role: Role.Manager,
        is_active: true,
      },
      {
        id: ids.developer,
        company_id: ids.company,
        department_id: ids.managedDepartment,
        email: `developer-${uuid()}@example.test`,
        password_hash: passwordHash,
        first_name: 'Private',
        last_name: 'Developer',
        role: Role.Employee,
        is_active: true,
      },
      {
        id: ids.outsideDeveloper,
        company_id: ids.otherCompany,
        department_id: ids.outsideDepartment,
        email: `developer-${uuid()}@example.test`,
        password_hash: passwordHash,
        first_name: 'Outside',
        last_name: 'Developer',
        role: Role.Employee,
        is_active: true,
      },
    ]);
    await transaction('departments')
      .where({ id: ids.managedDepartment })
      .update({ manager_id: ids.manager });
    await transaction('departments')
      .where({ id: ids.otherDepartment })
      .update({ manager_id: ids.otherManager });
    await transaction('projects').insert([
      {
        id: ids.managedProject,
        company_id: ids.company,
        owner_id: ids.manager,
        department_id: ids.managedDepartment,
        name: 'Managed Project',
      },
      {
        id: ids.otherProject,
        company_id: ids.company,
        owner_id: ids.otherManager,
        department_id: ids.otherDepartment,
        name: 'Other Project',
      },
      {
        id: ids.outsideProject,
        company_id: ids.otherCompany,
        owner_id: ids.outsideDeveloper,
        department_id: ids.outsideDepartment,
        name: 'Outside Project',
      },
    ]);

    const service = new StandupNotesService(transaction as unknown as Knex);
    const date = '2026-08-28';
    const admin = { id: ids.admin, company_id: ids.company, role: Role.Admin };
    const otherAdmin = { id: ids.otherAdmin, company_id: ids.company, role: Role.Admin };
    const manager = { id: ids.manager, company_id: ids.company, role: Role.Manager };
    const otherManager = { id: ids.otherManager, company_id: ids.company, role: Role.Manager };
    const developer = { id: ids.developer, company_id: ids.company, role: Role.Employee };

    const adminNote = await service.save(admin, ids.developer, {
      standup_date: date,
      content: 'Only the author should see this.',
      project_id: ids.managedProject,
    });
    const secondProjectNote = await service.save(admin, ids.developer, {
      standup_date: date,
      content: 'A separate note for the other project.',
      project_id: ids.otherProject,
    });
    assert.notEqual(adminNote.id, secondProjectNote.id);
    assert.equal((await service.findAll(admin, date)).length, 2);
    assert.equal(adminNote.project.id, ids.managedProject);
    assert.equal(secondProjectNote.project.id, ids.otherProject);
    assert.equal((await service.findAll(otherAdmin, date)).length, 0);
    assert.equal((await service.findByProject(admin, ids.managedProject)).length, 1);
    assert.equal((await service.findByProject(admin, ids.otherProject)).length, 1);
    assert.equal((await service.findByProject(otherAdmin, ids.managedProject)).length, 0);

    await assert.rejects(
      service.remove(otherAdmin, adminNote.id),
      (error: unknown) => error instanceof NotFoundException,
    );
    await assert.rejects(
      service.findAll(developer, date),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      service.findByProject(developer, ids.managedProject),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await service.save(manager, ids.developer, {
      standup_date: date,
      content: 'Manager-owned private note.',
      project_id: ids.managedProject,
    });
    const managerNotes = await service.findAll(manager, date);
    assert.equal(managerNotes.length, 1);
    assert.equal(managerNotes[0].project.id, ids.managedProject);
    assert.equal((await service.findByProject(manager, ids.managedProject)).length, 1);
    assert.ok(
      (await service.findAll(admin, date))
        .some((note) => note.content === 'Only the author should see this.'),
    );

    await assert.rejects(
      service.save(otherManager, ids.developer, {
        standup_date: date,
        content: 'Not allowed',
        project_id: ids.otherProject,
      }),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      service.save(manager, ids.developer, {
        standup_date: date,
        content: 'Project not allowed',
        project_id: ids.otherProject,
      }),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      service.save(admin, ids.outsideDeveloper, {
        standup_date: date,
        content: 'Not allowed',
        project_id: ids.outsideProject,
      }),
      (error: unknown) => error instanceof NotFoundException,
    );
  } finally {
    await transaction.rollback();
    await database.destroy();
  }
});
