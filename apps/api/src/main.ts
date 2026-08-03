import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { join, resolve } from 'path';
import { mkdirSync } from 'fs';
import knex from 'knex';
import * as dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  const db = knex({
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME || 'gkkerp',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'secret',
    },
    migrations: {
      directory: resolve(__dirname, 'database/migrations'),
    },
  });
  try {
    const [batch, files] = await db.migrate.latest();
    if (files.length) console.log(`Migrations: batch ${batch}, ran ${files.length} file(s)`);
    else console.log('Migrations: already up to date');
  } finally {
    await db.destroy();
  }
}

async function bootstrap() {
  await runMigrations();

  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(uploadsDir, { recursive: true });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

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
