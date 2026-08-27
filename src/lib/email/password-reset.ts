import 'server-only';

import { createPasswordResetToken } from '@/lib/auth/password-reset-token';
import { absoluteUrl } from '@/lib/app-url';
import { RESET_PASSWORD_PATH } from '@/lib/auth-redirect';

import { EMAIL_FROM, getResend } from './client';
import { sentAtNote } from './sent-at';

const SUBJECT = 'Reset your DevFetch password';

/** How the shared "sent at" note names this email. */
const RESET_EMAIL = 'password reset email';

/**
 * Said in both templates: someone who did not ask for this needs to know that
 * ignoring it is enough — no password changes until the link is followed.
 */
const IGNORE_NOTE =
  'If you did not ask to reset your password, you can ignore this email — your password stays as it is.';

function resetHtml(resetUrl: string, sentAt: Date): string {
  // Inlined styles and a table-free single column: every rule below is one an
  // email client can be relied on to honour.
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
        Choose a new password for your DevFetch account.
      </p>
      <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;">
        Reset password
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        Or paste this link into your browser:<br />
        <span style="word-break:break-all;">${resetUrl}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        ${sentAtNote(sentAt, RESET_EMAIL)}
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        This link expires in 1 hour. ${IGNORE_NOTE}
      </p>
    </div>
  `;
}

function resetText(resetUrl: string, sentAt: Date): string {
  return [
    'Reset your password',
    '',
    'Choose a new password for your DevFetch account:',
    resetUrl,
    '',
    sentAtNote(sentAt, RESET_EMAIL),
    '',
    'This link expires in 1 hour.',
    IGNORE_NOTE,
  ].join('\n');
}

/**
 * Issues a token and emails the reset link.
 *
 * Returns rather than throws, like `sendVerificationEmail`: the caller replies
 * the same way whether or not anything went out, so that a failed send does
 * not become the one response that reveals the address is registered.
 */
export async function sendPasswordResetEmail(email: string): Promise<{ ok: boolean }> {
  let resetUrl: string;

  try {
    const token = await createPasswordResetToken(email);
    resetUrl = absoluteUrl(`${RESET_PASSWORD_PATH}?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Could not issue a password reset token:', error);

    return { ok: false };
  }

  // Stamped here rather than inside each template, so the HTML and the plain
  // text cannot disagree by the milliseconds between rendering them.
  const sentAt = new Date();

  try {
    // The SDK reports failures in `error` instead of throwing, so a send that
    // never happened would otherwise read as a success.
    const { error } = await getResend().emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject: SUBJECT,
      html: resetHtml(resetUrl, sentAt),
      text: resetText(resetUrl, sentAt),
    });

    if (error) {
      // Until a domain is verified, anything but the Resend account's own
      // address comes back here as a 403.
      console.error('Resend rejected the password reset email:', error);

      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    // A network failure or a missing RESEND_API_KEY does throw.
    console.error('Could not send the password reset email:', error);

    return { ok: false };
  }
}
