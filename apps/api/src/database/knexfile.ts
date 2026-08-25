import type { Knex } from 'knex';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../../.env') });

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

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'mysql2',
    connection: dbConnection(),
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './seeds',
      extension: 'ts',
    },
  },
  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
    },
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './migrations',
      extension: 'ts',
    },
  },
};

module.exports = config;
export default config;
