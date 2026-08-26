import 'server-only';

import { createEmailVerificationToken } from '@/lib/auth/verification-token';
import { absoluteUrl } from '@/lib/app-url';

import { EMAIL_FROM, getResend } from './client';

const SUBJECT = 'Verify your email for DevFetch';

/**
 * Fixed to UTC, like `lib/format.ts`, so the stamp does not depend on where
 * the server happens to run. Kept local — nothing else sends mail yet.
 */
const SENT_AT_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/**
 * Issuing a token deletes the one before it, so an inbox holding several of
 * these has exactly one working link and no way to tell which — the subject
 * and body are otherwise identical, and mail clients thread them together.
 * The timestamp is what makes the newest identifiable.
 */
function sentAtNote(sentAt: Date): string {
  return `Sent ${SENT_AT_FORMATTER.format(sentAt)}. If you asked for more than one verification email, only the most recent link works.`;
}

function verificationHtml(verifyUrl: string, sentAt: Date): string {
  // Inlined styles and a table-free single column: every rule below is one an
  // email client can be relied on to honour.
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a;">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">Verify your email</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
        Confirm this address to finish setting up your DevFetch account.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;">
        Verify email
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        Or paste this link into your browser:<br />
        <span style="word-break:break-all;">${verifyUrl}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        ${sentAtNote(sentAt)}
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
        This link expires in 24 hours. If you did not create a DevFetch account, you can ignore this email.
      </p>
    </div>
  `;
}

function verificationText(verifyUrl: string, sentAt: Date): string {
  return [
    'Verify your email',
    '',
    'Confirm this address to finish setting up your DevFetch account:',
    verifyUrl,
    '',
    sentAtNote(sentAt),
    '',
    'This link expires in 24 hours.',
    'If you did not create a DevFetch account, you can ignore this email.',
  ].join('\n');
}

/**
 * Issues a token and emails the link.
 *
 * Returns rather than throws, because no caller should fail on it: an account
 * is still created when the send fails, and a resend request must look the
 * same to the caller whether or not anything went out.
 */
export async function sendVerificationEmail(email: string): Promise<{ ok: boolean }> {
  let verifyUrl: string;

  try {
    const token = await createEmailVerificationToken(email);
    verifyUrl = absoluteUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  } catch (error) {
    console.error('Could not issue a verification token:', error);

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
      html: verificationHtml(verifyUrl, sentAt),
      text: verificationText(verifyUrl, sentAt),
    });

    if (error) {
      // Until a domain is verified, anything but the Resend account's own
      // address comes back here as a 403.
      console.error('Resend rejected the verification email:', error);

      return { ok: false };
    }

    return { ok: true };
  } catch (error) {
    // A network failure or a missing RESEND_API_KEY does throw.
    console.error('Could not send the verification email:', error);

    return { ok: false };
  }
}
