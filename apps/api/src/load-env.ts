import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';

/** Load API + repo-root .env files. Empty values do not block a later file. */
export function loadEnvFiles(): string[] {
  const loaded: string[] = [];
  const seen = new Set<string>();
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  for (const file of candidates) {
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const parsed = dotenv.parse(readFileSync(file));
    for (const [key, value] of Object.entries(parsed)) {
      const current = process.env[key];
      if (current == null || String(current).trim() === '') {
        process.env[key] = value;
      }
    }
    loaded.push(file);
  }
  return loaded;
}
