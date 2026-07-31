import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chat_conversations', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    t.enum('type', ['direct', 'department']).notNullable();
    t.uuid('department_id').nullable().references('id').inTable('departments').onDelete('CASCADE');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('chat_conversation_members', (t) => {
    t.uuid('conversation_id').notNullable().references('id').inTable('chat_conversations').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.primary(['conversation_id', 'user_id']);
  });

  await knex.schema.createTable('chat_messages', (t) => {
    t.uuid('id').primary();
    t.uuid('conversation_id').notNullable().references('id').inTable('chat_conversations').onDelete('CASCADE');
    t.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('content').notNullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('chat_message_reads', (t) => {
    t.uuid('message_id').notNullable().references('id').inTable('chat_messages').onDelete('CASCADE');
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamp('read_at').defaultTo(knex.fn.now());
    t.primary(['message_id', 'user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chat_message_reads');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_conversation_members');
  await knex.schema.dropTableIfExists('chat_conversations');
}
