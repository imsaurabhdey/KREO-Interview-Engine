/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Enterprise Transactional Email Service via Brevo (formerly Sendinblue) v3 API.
 * Handles candidate interview invitations, completion confirmations, and user password resets.
 */

export interface TransactionalEmailDetails {
  assessmentTitle?: string;
  startLink?: string;
  score?: number;
  resetCode?: string;
  resetLink?: string;
}

export type EmailPurpose = 'INVITATION' | 'COMPLETED' | 'PASSWORD_RESET';

/**
 * Dispatches a formatted transactional email via Brevo API (or logs in simulated sandbox mode).
 */
export async function sendCandidateEmail(
  toEmail: string,
  candidateName: string,
  type: EmailPurpose,
  details: TransactionalEmailDetails
): Promise<{ success: boolean; mode: 'sent' | 'simulated'; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const simulated = !apiKey || apiKey === 'MY_BREVO_API_KEY' || apiKey.trim().length === 0;

  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim() || 'talent@kreo-assessment.com';
  const senderName = process.env.BREVO_SENDER_NAME?.trim() || 'kreo AI Assessment Engine';

  let subject = '';
  let html = '';
  const asmtTitle = details.assessmentTitle || 'Assessment';

  if (type === 'INVITATION') {
    subject = `Action Required: Invitation to take your ${asmtTitle} on kreo`;
    html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <span style="font-size: 20px; font-weight: 800; color: #4f46e5; letter-spacing: -0.025em; font-family: sans-serif;">kreo AI ENGINE</span>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px; letter-spacing: -0.025em;">Hi ${candidateName},</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 16px;">
          You have been invited by the talent acquisition team to undergo an industry-grade, proctored AI assessment for the <strong>${asmtTitle}</strong> position.
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <h4 style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 8px 0;">Assessment Safeguards</h4>
          <ul style="font-size: 12px; color: #475569; padding-left: 18px; margin: 0; line-height: 1.6;">
            <li>The assessment runs entirely in secure, fullscreen browser mode.</li>
            <li>Real-time AI gaze-tracking and eye-coordinate systems are active.</li>
            <li>Tab switches, minimizes, or right-clicks invoke immediate security logs.</li>
            <li>Suri, your conversation proctor, checks clarity verbally.</li>
          </ul>
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${details.startLink}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #4f46e5; color: #ffffff; font-weight: 600; font-size: 14px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.1), 0 2px 4px -1px rgba(79, 70, 229, 0.06); transition: background-color 0.15s ease;">
            Start Secured Assessment
          </a>
        </div>
        <p style="font-size: 11px; text-align: center; color: #94a3b8; font-family: monospace; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Direct Access URL: <a href="${details.startLink}" style="color: #4f46e5; text-decoration: none;">${details.startLink}</a>
        </p>
      </div>
    `;
  } else if (type === 'COMPLETED') {
    subject = `Assessment Completed: ${asmtTitle} on kreo`;
    html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <span style="font-size: 20px; font-weight: 800; color: #10b981; letter-spacing: -0.025em; font-family: sans-serif;">kreo AI ENGINE</span>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px; letter-spacing: -0.025em;">Great Work, ${candidateName}!</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 16px;">
          Your secured interview session for the <strong>${asmtTitle}</strong> position has been submitted successfully to our evaluation workspace.
        </p>
        <div style="text-align: center; margin: 24px 0; padding: 20px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; color: #166534;">
          <p style="font-size: 13px; font-weight: 600; margin: 0 0 4px 0;">INTERVIEW LOGS RECEIVED & SECURED</p>
          <p style="font-size: 12px; margin: 0; color: #15803d;">Our talent recruiters have received your AI feedback reports and proctor scores.</p>
        </div>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
          The recruiting coordinator from the organization will review the synthesized insights shortly and contact you regarding the next steps in your candidacy.
        </p>
        <p style="font-size: 11px; text-align: center; color: #94a3b8; font-family: monospace; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          SECURED VIA kreo AI SYSTEM INTEGRITY ENFORCEMENT. THANK YOU!
        </p>
      </div>
    `;
  } else if (type === 'PASSWORD_RESET') {
    subject = `Reset Your Password — kreo AI Engine`;
    html = `
      <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="margin-bottom: 24px; text-align: center;">
          <span style="font-size: 20px; font-weight: 800; color: #4f46e5; letter-spacing: -0.025em; font-family: sans-serif;">kreo AI ENGINE</span>
        </div>
        <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px; letter-spacing: -0.025em;">Password Reset Verification</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 16px;">
          Hi ${candidateName || 'there'}, we received a request to reset the password for your kreo workspace account (<strong>${toEmail}</strong>).
        </p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
          <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin: 0 0 10px 0; font-weight: 700;">6-Digit Security Verification Code</p>
          <div style="font-size: 32px; font-weight: 800; letter-spacing: 0.25em; color: #4f46e5; font-family: monospace; padding: 10px 20px; background: #ffffff; display: inline-block; border-radius: 8px; border: 1px dashed #818cf8;">
            ${details.resetCode || '123456'}
          </div>
          <p style="font-size: 11px; color: #94a3b8; margin: 12px 0 0 0;">This code is valid for 15 minutes.</p>
        </div>
        <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
          <p style="font-size: 12px; color: #92400e; margin: 0; line-height: 1.5;">
            <strong>Security Notice:</strong> If you did not initiate this password reset, please ignore this email or notify your system administrator. Your current password remains active and secure.
          </p>
        </div>
        <p style="font-size: 11px; text-align: center; color: #94a3b8; font-family: monospace; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          SECURED VIA kreo AI ENTERPRISE AUTHENTICATION GATEWAY
        </p>
      </div>
    `;
  }

  if (simulated) {
    console.log(`\n======================================================`);
    console.log(`[SIMULATED EMAIL DISPATCH] (No BREVO_API_KEY configured)`);
    console.log(`Type: ${type}`);
    console.log(`To: ${toEmail}`);
    console.log(`Candidate / User: ${candidateName}`);
    console.log(`Sender: ${senderName} <${senderEmail}>`);
    console.log(`Subject: ${subject}`);
    if (details.resetCode) {
      console.log(`RESET VERIFICATION CODE: >>> ${details.resetCode} <<<`);
    }
    console.log(`Details:`, details);
    console.log(`======================================================\n`);
    return { success: true, mode: 'simulated' };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey.trim(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail
        },
        to: [
          {
            email: toEmail,
            name: candidateName
          }
        ],
        subject: subject,
        htmlContent: html
      })
    });

    if (response.ok) {
      const data: any = await response.json().catch(() => ({}));
      const messageId = data?.messageId || 'brevo-queued';
      console.log(`[BREVO SUCCESS] Email dispatched to ${toEmail} (messageId: ${messageId}, Type: ${type})`);
      return { success: true, mode: 'sent', messageId };
    } else {
      const errBody = await response.text();
      console.error(`[BREVO FAILURE] Failed to send to ${toEmail}. Status: ${response.status}. Log:`, errBody);
      return { success: false, mode: 'simulated', error: errBody };
    }
  } catch (error: any) {
    console.error(`[BREVO EXCEPTION] Network error during dispatch to ${toEmail}:`, error);
    return { success: false, mode: 'simulated', error: error.message };
  }
}

/**
 * Convenience helper for sending password reset emails with verification codes.
 */
export async function sendPasswordResetEmail(
  toEmail: string,
  userName: string,
  resetCode: string
) {
  return sendCandidateEmail(toEmail, userName, 'PASSWORD_RESET', { resetCode });
}
