import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('github_installations', (t) => {
    t.uuid('id').primary();
    t.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    t.bigInteger('github_installation_id').notNullable();
    t.bigInteger('github_account_id').notNullable();
    t.string('github_account_login', 255).notNullable();
    t.string('account_type', 32).notNullable();
    t.string('repository_selection', 32).notNullable().defaultTo('selected');
    t.string('status', 32).notNullable().defaultTo('active');
    t.boolean('notify_project_chat').notNullable().defaultTo(false);
    t.timestamp('installed_at').notNullable();
    t.timestamp('last_synced_at').nullable();
    t.timestamps(true, true);

    t.unique(['company_id'], 'gh_installations_company_unique');
    t.unique(['github_installation_id'], 'gh_installations_gh_id_unique');
  });

  await knex.schema.createTable('github_repositories', (t) => {
    t.uuid('id').primary();
    t.uuid('installation_id').notNullable().references('id').inTable('github_installations').onDelete('CASCADE');
    t.bigInteger('github_repository_id').notNullable();
    t.string('owner', 255).notNullable();
    t.string('name', 255).notNullable();
    t.string('full_name', 512).notNullable();
    t.string('default_branch', 255).nullable();
    t.boolean('private').notNullable().defaultTo(true);
    t.boolean('archived').notNullable().defaultTo(false);
    t.string('html_url', 500).notNullable();
    t.timestamp('github_created_at').nullable();
    t.timestamp('github_updated_at').nullable();
    t.timestamp('last_synced_at').nullable();
    t.timestamps(true, true);

    t.unique(['github_repository_id'], 'gh_repos_gh_id_unique');
    t.index(['installation_id']);
  });

  await knex.schema.createTable('project_github_repositories', (t) => {
    t.uuid('id').primary();
    t.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.uuid('github_repository_id').notNullable().references('id').inTable('github_repositories').onDelete('CASCADE');
    t.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    t.boolean('notify_chat').notNullable().defaultTo(false);
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.unique(['project_id', 'github_repository_id'], 'pgr_project_repo_unique');
    t.index(['github_repository_id']);
  });

  await knex.schema.createTable('user_github_accounts', (t) => {
    t.uuid('id').primary();
    t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.bigInteger('github_user_id').notNullable();
    t.string('github_username', 255).notNullable();
    t.string('avatar_url', 500).nullable();
    t.timestamp('connected_at').notNullable();
    t.timestamp('last_synced_at').nullable();
    t.timestamps(true, true);

    t.unique(['user_id'], 'uga_user_unique');
    t.unique(['github_user_id'], 'uga_github_user_unique');
  });

  await knex.schema.createTable('github_pull_requests', (t) => {
    t.uuid('id').primary();
    t.uuid('github_repository_id').notNullable().references('id').inTable('github_repositories').onDelete('CASCADE');
    t.bigInteger('github_pr_id').notNullable();
    t.integer('number').notNullable();
    t.string('title', 500).notNullable();
    t.text('body').nullable();
    t.bigInteger('github_author_id').nullable();
    t.string('author_login', 255).nullable();
    t.string('state', 32).notNullable();
    t.boolean('draft').notNullable().defaultTo(false);
    t.string('source_branch', 255).nullable();
    t.string('target_branch', 255).nullable();
    t.integer('additions').unsigned().nullable();
    t.integer('deletions').unsigned().nullable();
    t.integer('changed_files').unsigned().nullable();
    t.integer('commits_count').unsigned().nullable();
    t.boolean('merged').notNullable().defaultTo(false);
    t.string('html_url', 500).nullable();
    t.timestamp('merged_at').nullable();
    t.timestamp('closed_at').nullable();
    t.timestamp('github_created_at').nullable();
    t.timestamp('github_updated_at').nullable();
    t.timestamp('last_synced_at').nullable();
    t.timestamps(true, true);

    t.unique(['github_repository_id', 'github_pr_id'], 'gh_pr_repo_pr_unique');
    t.index(['github_repository_id', 'state']);
  });

  await knex.schema.createTable('github_pull_request_reviews', (t) => {
    t.uuid('id').primary();
    t.uuid('pull_request_id').notNullable().references('id').inTable('github_pull_requests').onDelete('CASCADE');
    t.bigInteger('github_review_id').notNullable();
    t.bigInteger('github_user_id').nullable();
    t.string('reviewer_login', 255).nullable();
    t.string('state', 64).notNullable();
    t.timestamp('submitted_at').nullable();
    t.timestamps(true, true);

    t.unique(['github_review_id'], 'gh_review_gh_id_unique');
    t.index(['pull_request_id']);
  });

  await knex.schema.createTable('github_commits', (t) => {
    t.uuid('id').primary();
    t.uuid('github_repository_id').notNullable().references('id').inTable('github_repositories').onDelete('CASCADE');
    t.string('sha', 64).notNullable();
    t.bigInteger('author_github_user_id').nullable();
    t.string('author_login', 255).nullable();
    t.string('author_name', 255).nullable();
    t.string('message', 500).notNullable();
    t.string('html_url', 500).nullable();
    t.timestamp('committed_at').nullable();
    t.timestamps(true, true);

    t.unique(['github_repository_id', 'sha'], 'gh_commits_repo_sha_unique');
  });

  await knex.schema.createTable('github_issues', (t) => {
    t.uuid('id').primary();
    t.uuid('github_repository_id').notNullable().references('id').inTable('github_repositories').onDelete('CASCADE');
    t.bigInteger('github_issue_id').notNullable();
    t.integer('number').notNullable();
    t.string('title', 500).notNullable();
    t.string('state', 32).notNullable();
    t.bigInteger('github_author_id').nullable();
    t.string('author_login', 255).nullable();
    t.bigInteger('github_assignee_id').nullable();
    t.json('labels').nullable();
    t.string('html_url', 500).nullable();
    t.boolean('is_pull_request').notNullable().defaultTo(false);
    t.timestamp('github_created_at').nullable();
    t.timestamp('github_updated_at').nullable();
    t.timestamp('closed_at').nullable();
    t.timestamp('last_synced_at').nullable();
    t.timestamps(true, true);

    t.unique(['github_repository_id', 'github_issue_id'], 'gh_issues_repo_issue_unique');
  });

  await knex.schema.createTable('github_issue_links', (t) => {
    t.uuid('id').primary();
    t.uuid('issue_id').notNullable().references('id').inTable('issues').onDelete('CASCADE');
    t.uuid('github_issue_id').notNullable().references('id').inTable('github_issues').onDelete('CASCADE');
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['issue_id', 'github_issue_id'], 'gh_issue_links_unique');
  });

  await knex.schema.createTable('github_releases', (t) => {
    t.uuid('id').primary();
    t.uuid('github_repository_id').notNullable().references('id').inTable('github_repositories').onDelete('CASCADE');
    t.bigInteger('github_release_id').notNullable();
    t.string('tag_name', 255).notNullable();
    t.string('name', 500).nullable();
    t.boolean('draft').notNullable().defaultTo(false);
    t.boolean('prerelease').notNullable().defaultTo(false);
    t.string('author_login', 255).nullable();
    t.string('html_url', 500).nullable();
    t.timestamp('published_at').nullable();
    t.timestamp('github_created_at').nullable();
    t.timestamps(true, true);

    t.unique(['github_release_id'], 'gh_releases_gh_id_unique');
    t.index(['github_repository_id']);
  });

  await knex.schema.createTable('github_webhook_events', (t) => {
    t.uuid('id').primary();
    t.string('github_delivery_id', 64).notNullable();
    t.string('event_type', 64).notNullable();
    t.string('action', 64).nullable();
    t.bigInteger('github_installation_id').nullable();
    t.bigInteger('github_repository_id').nullable();
    t.string('processing_status', 32).notNullable().defaultTo('pending');
    t.text('error_message').nullable();
    t.timestamp('received_at').notNullable();
    t.timestamp('processed_at').nullable();

    t.unique(['github_delivery_id'], 'gh_webhook_delivery_unique');
    t.index(['processing_status', 'received_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('github_webhook_events');
  await knex.schema.dropTableIfExists('github_releases');
  await knex.schema.dropTableIfExists('github_issue_links');
  await knex.schema.dropTableIfExists('github_issues');
  await knex.schema.dropTableIfExists('github_commits');
  await knex.schema.dropTableIfExists('github_pull_request_reviews');
  await knex.schema.dropTableIfExists('github_pull_requests');
  await knex.schema.dropTableIfExists('user_github_accounts');
  await knex.schema.dropTableIfExists('project_github_repositories');
  await knex.schema.dropTableIfExists('github_repositories');
  await knex.schema.dropTableIfExists('github_installations');
}
