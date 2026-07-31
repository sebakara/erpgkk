import { Knex } from 'knex';

export async function up(knex: Knex) {
  // Extend users with onboarding fields
  await knex.schema.alterTable('users', (t) => {
    t.string('nid', 100).nullable().after('phone');
    t.text('address').nullable().after('nid');
    t.string('bank_name', 200).nullable().after('address');
    t.string('bank_account_name', 200).nullable().after('bank_name');
    t.string('bank_account_number', 100).nullable().after('bank_account_name');
    t.string('passport_url', 500).nullable().after('bank_account_number');
    t.string('nid_url', 500).nullable().after('passport_url');
    t.string('emergency_contact_name', 200).nullable().after('nid_url');
    t.string('emergency_contact_phone', 50).nullable().after('emergency_contact_name');
    t.string('emergency_contact_relation', 100).nullable().after('emergency_contact_phone');
    t.boolean('onboarding_completed').defaultTo(false).after('emergency_contact_relation');
  });

  // Invitation tokens
  await knex.schema.createTable('invites', (t) => {
    t.uuid('id').primary().defaultTo(knex.fn.uuid());
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.string('token', 64).notNullable().unique();
    t.timestamp('expires_at').notNullable();
    t.boolean('used').defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex) {
  await knex.schema.dropTableIfExists('invites');
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('nid');
    t.dropColumn('address');
    t.dropColumn('bank_name');
    t.dropColumn('bank_account_name');
    t.dropColumn('bank_account_number');
    t.dropColumn('passport_url');
    t.dropColumn('nid_url');
    t.dropColumn('emergency_contact_name');
    t.dropColumn('emergency_contact_phone');
    t.dropColumn('emergency_contact_relation');
    t.dropColumn('onboarding_completed');
  });
}
