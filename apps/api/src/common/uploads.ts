import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/** Canonical disk folder: apps/api/uploads (works from src/ and dist/). */
export function getUploadsDir() {
  const dir = join(__dirname, '..', '..', 'uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Find a stored file even if an older process wrote it under cwd or repo-root uploads. */
export function resolveStoredFile(storedName: string) {
  const safe = storedName.replace(/[/\\]/g, '');
  const candidates = [
    join(getUploadsDir(), safe),
    join(process.cwd(), 'uploads', safe),
    join(process.cwd(), '..', '..', 'uploads', safe),
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}
