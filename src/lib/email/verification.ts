import 'server-only';

import { createEmailVerificationToken } from '@/lib/auth/verification-token';
import { absoluteUrl } from '@/lib/app-url';

import { EMAIL_FROM, getResend } from './client';
import { EMAIL_COLORS } from './colors';
import { sentAtNote } from './sent-at';

const SUBJECT = 'Verify your email for DevFetch';

/** How the shared "sent at" note names this email. */
const VERIFICATION_EMAIL = 'verification email';

function verificationHtml(verifyUrl: string, sentAt: Date): string {
  // Inlined styles and a table-free single column: every rule below is one an
  // email client can be relied on to honour.
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:${EMAIL_COLORS.text};">
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;">Verify your email</h1>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${EMAIL_COLORS.muted};">
        Confirm this address to finish setting up your DevFetch account.
      </p>
      <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:${EMAIL_COLORS.button};color:${EMAIL_COLORS.buttonText};font-size:15px;font-weight:500;text-decoration:none;">
        Verify email
      </a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">
        Or paste this link into your browser:<br />
        <span style="word-break:break-all;">${verifyUrl}</span>
      </p>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">
        ${sentAtNote(sentAt, VERIFICATION_EMAIL)}
      </p>
      <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:${EMAIL_COLORS.muted};">
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
    sentAtNote(sentAt, VERIFICATION_EMAIL),
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
