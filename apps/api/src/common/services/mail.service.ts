import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(config.get('SMTP_PORT', '587')),
      secure: config.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: config.get('SMTP_USER'),
        pass: config.get('SMTP_PASS'),
      },
    });
  }

  async sendPasswordReset(opts: { to: string; name: string; resetUrl: string }) {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#4f46e5;padding:32px 40px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">GKK ERP</h1>
            <p style="margin:4px 0 0;color:#c7d2fe;font-size:14px;">Password Reset</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Hi, ${opts.name}</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              We received a request to reset your password. Click the button below to choose a new one.
              This link expires in <strong>1 hour</strong>.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#4f46e5;border-radius:8px;">
                  <a href="${opts.resetUrl}"
                     style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                    Reset Password →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
              If you didn't request a password reset, you can safely ignore this email. Your password won't change.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} GKK ERP · This is an automated email, please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: `"GKK ERP" <${this.config.get('SMTP_USER')}>`,
        to: opts.to,
        subject: 'Reset your GKK ERP password',
        html,
      });
      this.logger.log(`Password reset email sent to ${opts.to}`);
    } catch (err) {
      this.logger.error(`Failed to send password reset to ${opts.to}: ${err.message}`);
      throw err;
    }
  }

  async sendNewsletter(opts: { to: string; name?: string; subject: string; content: string }) {
    const greeting = opts.name ? `Hi ${opts.name},` : 'Hello,';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#4f46e5;padding:28px 40px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${opts.subject}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;color:#374151;font-size:15px;">${greeting}</p>
            <div style="color:#374151;font-size:15px;line-height:1.7;">
              ${opts.content}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} GKK ERP ·
              You are receiving this because you are a registered contact.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.transporter.sendMail({
      from: `"GKK ERP" <${this.config.get('SMTP_USER')}>`,
      to: opts.to,
      subject: opts.subject,
      html,
    });
    this.logger.log(`Newsletter sent to ${opts.to}`);
  }

  async sendInvite(opts: { to: string; name: string; companyName: string; inviteUrl: string }) {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr>
          <td style="background:#4f46e5;padding:32px 40px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">${opts.companyName}</h1>
            <p style="margin:4px 0 0;color:#c7d2fe;font-size:14px;">Employee Portal</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Welcome, ${opts.name}!</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.6;">
              Your HR team has created an account for you at <strong>${opts.companyName}</strong>.
              Please complete your onboarding to activate your account.
            </p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#4f46e5;border-radius:8px;">
                  <a href="${opts.inviteUrl}"
                     style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
                    Complete Onboarding →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#9ca3af;font-size:13px;">
              This link expires in 7 days. If you didn't expect this email, you can safely ignore it.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              © ${new Date().getFullYear()} ${opts.companyName} · Powered by GKK ERP
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: `"${opts.companyName} HR" <${this.config.get('SMTP_USER')}>`,
        to: opts.to,
        subject: `You're invited to join ${opts.companyName}`,
        html,
      });
      this.logger.log(`Invite sent to ${opts.to}`);
    } catch (err) {
      this.logger.error(`Failed to send invite to ${opts.to}: ${err.message}`);
      throw err;
    }
  }
}
