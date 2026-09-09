import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CachedToken = { token: string; expiresAt: number };

@Injectable()
export class GitHubAppClient {
  private readonly logger = new Logger(GitHubAppClient.name);
  private readonly tokenCache = new Map<string, CachedToken>();

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return this.missingEnv().length === 0;
  }

  missingEnv(): string[] {
    const missing: string[] = [];
    if (!this.appId() || !/^\d+$/.test(this.appId())) missing.push('GITHUB_APP_ID');
    if (!this.appSlug()) missing.push('GITHUB_APP_SLUG');
    if (!this.privateKeyLooksValid()) missing.push('GITHUB_PRIVATE_KEY');
    return missing;
  }

  appSlug(): string {
    return this.config.get<string>('GITHUB_APP_SLUG', '').trim();
  }

  webhookSecret(): string {
    return this.config.get<string>('GITHUB_WEBHOOK_SECRET', '');
  }

  installUrl(state?: string): string {
    const slug = this.appSlug();
    const url = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
    if (state) url.searchParams.set('state', state);
    return url.toString();
  }

  manageUrl(installationId: string | number): string {
    return `https://github.com/settings/installations/${installationId}`;
  }

  async appOctokit(): Promise<any> {
    this.assertConfigured();
    const { Octokit } = await import('@octokit/rest');
    const { createAppAuth } = await import('@octokit/auth-app');
    return new Octokit({
      userAgent: 'GKK-ERP',
      authStrategy: createAppAuth,
      auth: {
        appId: this.appId(),
        privateKey: this.privateKey(),
      },
    });
  }

  async installationOctokit(installationId: string | number): Promise<any> {
    this.assertConfigured();
    const token = await this.installationToken(installationId);
    const { Octokit } = await import('@octokit/rest');
    return new Octokit({ userAgent: 'GKK-ERP', auth: token });
  }

  async installationToken(installationId: string | number): Promise<string> {
    this.assertConfigured();
    const key = String(installationId);
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const { createAppAuth } = await import('@octokit/auth-app');
    const auth = createAppAuth({
      appId: this.appId(),
      privateKey: this.privateKey(),
      installationId: Number(installationId),
    });
    const result = await auth({ type: 'installation' });
    const expiresAt = new Date(result.expiresAt).getTime();
    this.tokenCache.set(key, { token: result.token, expiresAt });
    return result.token;
  }

  clearToken(installationId: string | number) {
    this.tokenCache.delete(String(installationId));
  }

  private appId(): string {
    return String(this.config.get('GITHUB_APP_ID', '')).trim();
  }

  private privateKey(): string {
    let key = this.config.get<string>('GITHUB_PRIVATE_KEY', '') || '';
    key = key.trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }
    return key.replace(/\\n/g, '\n');
  }

  private privateKeyLooksValid(): boolean {
    const key = this.privateKey();
    return key.includes('BEGIN') && key.includes('PRIVATE KEY') && key.includes('END');
  }

  private assertConfigured() {
    const missing = this.missingEnv();
    if (missing.length) {
      this.logger.warn(`GitHub App credentials are missing: ${missing.join(', ')}`);
      throw new ServiceUnavailableException(
        `GitHub App is not configured. Set ${missing.join(', ')} in apps/api/.env and restart the API.`,
      );
    }
  }
}
