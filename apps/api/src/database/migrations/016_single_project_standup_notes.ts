import type { Knex } from 'knex';
import { v4 as uuid } from 'uuid';

const OLD_UNIQUE = ['author_id', 'subject_user_id', 'standup_date'];
const NEW_UNIQUE = ['author_id', 'subject_user_id', 'standup_date', 'project_id'];
const OLD_UNIQUE_NAME = 'standup_notes_author_id_subject_user_id_standup_date_unique';
const NEW_UNIQUE_NAME = 'standup_notes_author_subject_date_project_unique';
const PROJECT_INDEX_NAME = 'standup_notes_project_id_standup_date_index';
const PROJECT_FOREIGN_NAME = 'standup_notes_project_id_foreign';

async function hasIndex(knex: Knex, name: string) {
  const row = await knex('information_schema.statistics')
    .whereRaw('table_schema = DATABASE()')
    .where({ table_name: 'standup_notes', index_name: name })
    .first('index_name');
  return Boolean(row);
}

async function hasForeignKey(knex: Knex, name: string) {
  const row = await knex('information_schema.referential_constraints')
    .whereRaw('constraint_schema = DATABASE()')
    .where({ table_name: 'standup_notes', constraint_name: name })
    .first('constraint_name');
  return Boolean(row);
}

export async function up(knex: Knex): Promise<void> {
  if (await hasIndex(knex, OLD_UNIQUE_NAME)) {
    await knex.schema.alterTable('standup_notes', (t) => {
      t.dropUnique(OLD_UNIQUE);
    });
  }

  if (!(await knex.schema.hasColumn('standup_notes', 'project_id'))) {
    await knex.schema.alterTable('standup_notes', (t) => {
      t.uuid('project_id').nullable();
    });
  }

  if (await knex.schema.hasTable('standup_note_projects')) {
    const links = await knex('standup_note_projects')
      .select('standup_note_id', 'project_id')
      .orderBy('standup_note_id')
      .orderBy('project_id');

    const projectsByNote = new Map<string, string[]>();
    for (const link of links) {
      const projectIds = projectsByNote.get(link.standup_note_id) ?? [];
      projectIds.push(link.project_id);
      projectsByNote.set(link.standup_note_id, projectIds);
    }

    for (const [noteId, projectIds] of projectsByNote) {
      const note = await knex('standup_notes').where({ id: noteId }).first();
      if (!note || !projectIds.length) continue;

      await knex('standup_notes').where({ id: noteId }).update({ project_id: projectIds[0] });
      for (const projectId of projectIds.slice(1)) {
        await knex('standup_notes').insert({
          ...note,
          id: uuid(),
          project_id: projectId,
        });
      }
    }

    await knex.schema.dropTable('standup_note_projects');
  }

  if (!(await hasForeignKey(knex, PROJECT_FOREIGN_NAME))) {
    await knex.schema.alterTable('standup_notes', (t) => {
      t.foreign('project_id').references('id').inTable('projects').onDelete('CASCADE');
    });
  }
  if (!(await hasIndex(knex, PROJECT_INDEX_NAME))) {
    await knex.schema.alterTable('standup_notes', (t) => {
      t.index(['project_id', 'standup_date']);
    });
  }
  if (!(await hasIndex(knex, NEW_UNIQUE_NAME))) {
    await knex.schema.alterTable('standup_notes', (t) => {
      t.unique(NEW_UNIQUE, NEW_UNIQUE_NAME);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.createTable('standup_note_projects', (t) => {
    t.uuid('standup_note_id')
      .notNullable()
      .references('id')
      .inTable('standup_notes')
      .onDelete('CASCADE');
    t.uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    t.primary(['standup_note_id', 'project_id']);
    t.index(['project_id']);
  });

  await knex.raw(`
    INSERT INTO standup_note_projects (standup_note_id, project_id)
    SELECT id, project_id
    FROM standup_notes
    WHERE project_id IS NOT NULL
  `);

  // Rolling back merges project-specific copies back into one note per
  // author/developer/date, keeping the oldest record and all project links.
  const duplicates = await knex('standup_notes')
    .select('author_id', 'subject_user_id', 'standup_date')
    .groupBy('author_id', 'subject_user_id', 'standup_date')
    .havingRaw('COUNT(*) > 1');

  for (const group of duplicates) {
    const notes = await knex('standup_notes')
      .where(group)
      .orderBy('created_at')
      .orderBy('id');
    const keep = notes[0];
    for (const duplicate of notes.slice(1)) {
      await knex('standup_note_projects')
        .where({ standup_note_id: duplicate.id })
        .update({ standup_note_id: keep.id });
      await knex('standup_notes').where({ id: duplicate.id }).delete();
    }
  }

  await knex.schema.alterTable('standup_notes', (t) => {
    t.dropUnique(NEW_UNIQUE, NEW_UNIQUE_NAME);
    t.dropForeign(['project_id']);
    t.dropIndex(['project_id', 'standup_date']);
    t.dropColumn('project_id');
    t.unique(OLD_UNIQUE);
  });
}
