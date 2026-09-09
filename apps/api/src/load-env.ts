import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export function parseEnvFile(contents: string): Record<string, string> {
  const env: Record<string, string> = {};
  const lines = contents.replace(/^\uFEFF/, '').split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      i += 1;
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      i += 1;
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      i += 1;
      continue;
    }
    let value = line.slice(eq + 1);
    if (value.startsWith('"')) {
      ({ value, i } = readQuoted(lines, i, value, '"'));
    } else if (value.startsWith("'")) {
      ({ value, i } = readQuoted(lines, i, value, "'"));
    } else if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(value) && !value.includes('END')) {
      const parts = [value];
      i += 1;
      while (i < lines.length) {
        parts.push(lines[i]);
        if (lines[i].includes('-----END')) break;
        i += 1;
      }
      value = parts.join('\n');
    }
    env[key] = value;
    i += 1;
  }
  return env;
}

function readQuoted(
  lines: string[],
  index: number,
  first: string,
  quote: '"' | "'",
): { value: string; i: number } {
  const rest = first.slice(1);
  if (rest.endsWith(quote) && rest.length >= 1) {
    return { value: unescapeEnv(rest.slice(0, -1), quote), i: index };
  }
  const parts = [rest];
  let i = index + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (line.endsWith(quote)) {
      parts.push(line.slice(0, -1));
      break;
    }
    parts.push(line);
    i += 1;
  }
  return { value: unescapeEnv(parts.join('\n'), quote), i };
}

function unescapeEnv(value: string, quote: '"' | "'"): string {
  if (quote === '"') {
    return value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"');
  }
  return value;
}

/** Load API + repo-root .env files. Empty values do not block a later file. */
export function loadEnvFiles(): string[] {
  const loaded: string[] = [];
  const seen = new Set<string>();
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(__dirname, '../.env'),
    resolve(__dirname, '../../.env'),
    resolve(process.cwd(), '../../.env'),
    '/var/www/erpgkk/apps/api/.env',
    '/var/www/erpgkk/.env',
  ];

  for (const file of candidates) {
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const parsed = parseEnvFile(readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      const current = process.env[key];
      if (shouldSetEnv(key, current, value)) {
        process.env[key] = value;
      }
    }
    loaded.push(file);
  }

  const pemPath = String(process.env.GITHUB_PRIVATE_KEY || '').trim();
  if (pemPath && existsSync(pemPath) && !pemPath.includes('BEGIN')) {
    process.env.GITHUB_PRIVATE_KEY = readFileSync(pemPath, 'utf8');
  }

  return loaded;
}

function shouldSetEnv(key: string, current: string | undefined, next: string): boolean {
  if (current == null || String(current).trim() === '') return true;
  if (key === 'GITHUB_PRIVATE_KEY' && !looksLikePem(current) && looksLikePem(next)) return true;
  return false;
}

function looksLikePem(value: string): boolean {
  const key = value.replace(/\\n/g, '\n');
  return key.includes('BEGIN') && key.includes('PRIVATE KEY') && key.includes('END');
}
