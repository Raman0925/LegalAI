import { Resend } from 'resend';
import { config } from '#config/index.js';

// Single Resend client instance
const resend = new Resend(config.resendApiKey);

interface InviteEmailParams {
  to: string;
  firmName: string;
  inviteUrl: string;
}

/**
 * Send an invitation email to a new team member.
 * Uses Resend transactional email API.
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'LegalAI <noreply@yourdomain.com>',
    to: params.to,
    subject: `You've been invited to join ${params.firmName} on LegalAI`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to LegalAI</h2>
        <p>
          You've been invited to join <strong>${params.firmName}</strong>
          on LegalAI — an AI-powered legal intelligence platform.
        </p>
        <p>This invitation expires in 7 days.</p>
        <a
          href="${params.inviteUrl}"
          style="
            display: inline-block;
            background: #1a56db;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
            margin: 16px 0;
          "
        >
          Accept Invitation
        </a>
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't expect this invitation, you can ignore this email.
        </p>
      </div>
    `,
  });

  if (error) {
    // Log but don't throw — email failure should not break the invite flow
    console.error('[resend] Failed to send invite email:', error);
  }
}

interface UsageAlertEmailParams {
  to: string;
  firmName: string;
  metric: string;
  percentUsed: number;
  upgradeUrl: string;
}

/**
 * Send a usage alert when firm hits 80% of any limit.
 */
export async function sendUsageAlertEmail(params: UsageAlertEmailParams): Promise<void> {
  const { error } = await resend.emails.send({
    from: 'LegalAI <noreply@yourdomain.com>',
    to: params.to,
    subject: `Action needed: You've used ${params.percentUsed}% of your ${params.metric} limit`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Usage Alert — ${params.firmName}</h2>
        <p>
          You've used <strong>${params.percentUsed}%</strong> of your
          <strong>${params.metric}</strong> limit for this billing period.
        </p>
        <p>Upgrade your plan to avoid interruption to your work.</p>
        <a
          href="${params.upgradeUrl}"
          style="
            display: inline-block;
            background: #f59e0b;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 600;
          "
        >
          Upgrade Plan
        </a>
      </div>
    `,
  });

  if (error) {
    console.error('[resend] Failed to send usage alert:', error);
  }
}
