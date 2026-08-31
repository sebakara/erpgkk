import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { v4 as uuid } from 'uuid';
import { UsersService } from '../users/users.service';
import { Inject } from '@nestjs/common';
import { KNEX_CONNECTION } from '../database/database.module';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { MailService } from '../common/services/mail.service';

@Injectable()
export class AuthService {
  constructor(
    @Inject(KNEX_CONNECTION) private readonly knex: Knex,
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');

    const companyId = uuid();
    const slug = dto.companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + companyId.slice(0, 6);

    await this.knex('companies').insert({
      id: companyId,
      name: dto.companyName,
      slug,
      plan: 'free',
    });

    const userId = uuid();
    const password_hash = await bcrypt.hash(dto.password, 10);
    await this.knex('users').insert({
      id: userId,
      company_id: companyId,
      email: dto.email,
      password_hash,
      first_name: dto.firstName,
      last_name: dto.lastName,
      role: 'admin',
      job_title: dto.jobTitle || null,
    });

    const user = await this.usersService.findById(userId);
    return this.buildTokenResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.is_active) throw new UnauthorizedException('Account disabled');

    const full = await this.usersService.findById(user.id);
    return this.buildTokenResponse(full);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const password_hash = await bcrypt.hash(newPassword, 10);
    await this.knex('users').where({ id: userId }).update({ password_hash, updated_at: new Date() });
    return { message: 'Password changed' };
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Always return success to avoid user enumeration
    if (!user) return { message: 'If that email exists, a reset link has been sent.' };

    // Invalidate old unused tokens for this user
    await this.knex('password_resets').where({ user_id: user.id }).whereNull('used_at').delete();

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.knex('password_resets').insert({
      id: uuid(),
      user_id: user.id,
      token,
      expires_at: expiresAt,
    });

    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3002');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset({
      to: user.email,
      name: user.first_name,
      resetUrl,
    });

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.knex('password_resets').where({ token }).whereNull('used_at').first();

    if (!record) throw new BadRequestException('Invalid or expired reset link.');
    if (new Date(record.expires_at) < new Date()) throw new BadRequestException('Reset link has expired.');

    const password_hash = await bcrypt.hash(newPassword, 10);
    await this.knex('users').where({ id: record.user_id }).update({ password_hash, updated_at: new Date() });
    await this.knex('password_resets').where({ id: record.id }).update({ used_at: new Date() });

    return { message: 'Password updated. You can now log in.' };
  }

  private buildTokenResponse(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const { password_hash, ...safe } = user;
    return {
      access_token: this.jwtService.sign(payload),
      user: safe,
    };
  }
}
