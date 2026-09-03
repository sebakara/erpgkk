import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { join, resolve } from 'path';
import { readdirSync } from 'fs';
import knex from 'knex';
import * as dotenv from 'dotenv';
import { getUploadsDir } from './common/uploads';

dotenv.config({ path: resolve(__dirname, '../.env') });

function dbConnection() {
  const socketPath = process.env.DB_SOCKET;
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'gkkerp',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ...(socketPath ? { socketPath } : {}),
  };
}

async function runMigrations() {
  const db = knex({
    client: 'mysql2',
    connection: dbConnection(),
  });
  try {
    // Ensure tracking tables exist
    if (!(await db.schema.hasTable('knex_migrations'))) {
      await db.schema.createTable('knex_migrations', (t) => {
        t.increments('id');
        t.string('name');
        t.integer('batch');
        t.timestamp('migration_time').defaultTo(db.fn.now());
      });
    }
    if (!(await db.schema.hasTable('knex_migrations_lock'))) {
      await db.schema.createTable('knex_migrations_lock', (t) => {
        t.integer('index').primary();
        t.integer('is_locked');
      });
      await db('knex_migrations_lock').insert({ index: 1, is_locked: 0 });
    }

    const completed: string[] = await db('knex_migrations').pluck('name');
    const migrationsDir = resolve(__dirname, 'database', 'migrations');
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.js') || (f.endsWith('.ts') && !f.endsWith('.d.ts')))
      .sort();

    const batchResult = await db('knex_migrations').max('batch as m');
    const batch = ((batchResult[0] as any).m ?? 0) + 1;

    for (const file of files) {
      if (!completed.includes(file)) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const migration = require(join(migrationsDir, file));
        await migration.up(db);
        await db('knex_migrations').insert({ name: file, batch, migration_time: new Date() });
        console.log(`Migration ran: ${file}`);
      }
    }
    console.log('Migrations: up to date');
  } finally {
    await db.destroy();
  }
}

async function bootstrap() {
  await runMigrations();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.useStaticAssets(getUploadsDir(), { prefix: '/uploads' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ transform: true }),
  );
  app.enableCors({
    origin: config.get('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  const port = config.get<number>('PORT', 3001);
  await app.listen(port);
  console.log(`API running → http://localhost:${port}/api`);
}
bootstrap();
