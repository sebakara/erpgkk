import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Clients
  await knex.schema.createTable('clients', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    t.string('name').notNullable();
    t.string('email').nullable();
    t.string('phone').nullable();
    t.string('website').nullable();
    t.string('industry').nullable();
    t.text('address').nullable();
    t.enum('status', ['prospect', 'active', 'inactive', 'churned']).notNullable().defaultTo('prospect');
    t.text('notes').nullable();
    t.timestamps(true, true);
    t.timestamp('deleted_at').nullable();
  });

  // Project ↔ Client (many-to-many)
  await knex.schema.createTable('project_clients', (t) => {
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.primary(['project_id', 'client_id']);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  // Newsletters
  await knex.schema.createTable('newsletters', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    t.uuid('author_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    t.string('subject').notNullable();
    t.text('content').nullable();
    t.enum('status', ['draft', 'sent']).notNullable().defaultTo('draft');
    t.timestamp('sent_at').nullable();
    t.integer('recipient_count').notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.timestamp('deleted_at').nullable();
  });

  // Individual send records (one row per recipient per newsletter)
  await knex.schema.createTable('newsletter_sends', (t) => {
    t.uuid('id').primary();
    t.uuid('newsletter_id').notNullable().references('id').inTable('newsletters').onDelete('CASCADE');
    t.string('email').notNullable();
    t.string('name').nullable();
    t.timestamp('sent_at').nullable();
    t.text('error').nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('newsletter_sends');
  await knex.schema.dropTableIfExists('newsletters');
  await knex.schema.dropTableIfExists('project_clients');
  await knex.schema.dropTableIfExists('clients');
}
