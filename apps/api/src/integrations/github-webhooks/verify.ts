import { createHmac, timingSafeEqual } from 'crypto';

export function verifyGitHubSignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!secret || !signature || !rawBody) return false;
  const expected = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
