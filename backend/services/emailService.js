import nodemailer from 'nodemailer';

let testAccount = null;
let cachedTransporter = null;

/**
 * Helper to retrieve a nodemailer transporter.
 * Caches the transporter and enables connection pooling to dramatically speed up email delivery.
 */
const getTransporter = async () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPassword = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;

  if (emailUser && emailPassword) {
    // If using Gmail, use optimized direct Gmail transport with persistent connection pooling
    if (emailUser.includes('gmail.com')) {
      cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5
      });
      return cachedTransporter;
    }

    let host = process.env.SMTP_HOST || 'smtp.ethereal.email';
    let port = parseInt(process.env.SMTP_PORT) || 587;
    let secure = port === 465;

    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      pool: true,
      maxConnections: 5
    });
    return cachedTransporter;
  }

  // Create temporary Ethereal account if no env credentials found
  if (!testAccount) {
    try {
      console.log('[EmailService] Creating a temporary Ethereal Email account for recovery testing...');
      testAccount = await nodemailer.createTestAccount();
      console.log(`[EmailService] Temp account generated: ${testAccount.user}`);
    } catch (err) {
      console.error('[EmailService] Failed to create Ethereal test account:', err.message);
    }
  }

  if (testAccount) {
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  // Ultimate fallback
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: '', pass: '' }
  });
};

/**
 * Sends a password reset OTP email.
 * 
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {number} expiryMinutes 
 */
/**
 * Sends an OTP email for password reset or account registration.
 * 
 * @param {string} toEmail 
 * @param {string} otp 
 * @param {number} expiryMinutes 
 * @param {string} purpose
 */
export const sendOtpEmail = async (toEmail, otp, expiryMinutes = 5, purpose = 'Password Reset') => {
  const isRegistration = purpose.toLowerCase().includes('register') || purpose.toLowerCase().includes('verification');
  const subject = isRegistration ? 'CampusHub Account Registration Verification' : 'CampusHub Password Reset';
  const heading = isRegistration ? 'Verify Your Email Address' : 'CampusHub Password Reset';
  const message = isRegistration
    ? 'Thank you for joining CampusHub! Your verification code (OTP) for completing your registration is:'
    : 'Your OTP for resetting your CampusHub password is:';

  const transporter = await getTransporter();
  const senderEmail = process.env.EMAIL_USER || process.env.SMTP_USER || 'no-reply@campushub.edu';

  const mailOptions = {
    from: `"CampusHub" <${senderEmail}>`,
    to: toEmail,
    subject,
    text: `Your CampusHub OTP verification code is: ${otp}. This code will expire in ${expiryMinutes} minutes. If you did not request this code, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <h2 style="color: #0d6efd; margin: 0 0 20px 0; font-size: 22px; border-bottom: 2px solid #0d6efd; padding-bottom: 10px;">${heading}</h2>
        <div style="color: #333333; line-height: 1.6; font-size: 15px;">
          <p>${message}</p>
          <div style="margin: 25px 0; font-size: 32px; font-weight: bold; color: #0d6efd; letter-spacing: 4px; text-align: center; background: #f0f7ff; padding: 15px; border-radius: 8px;">
            ${otp}
          </div>
          <p>This verification code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
          <p style="color: #666666; font-size: 13px; margin-top: 20px;">If you did not request this code, please ignore this email.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] OTP (${purpose}) sent successfully to ${toEmail}. MessageId: ${info.messageId}`);

    // If using dynamic test account, output preview details to the console
    if (testAccount && transporter.options?.auth?.user === testAccount.user) {
      console.log(`\n==================================================`);
      console.log(`📬 [MOCK EMAIL] OTP Sent to: ${toEmail}`);
      console.log(`🔑 Verification code: ${otp}`);
      console.log(`🔗 Click to view preview: ${nodemailer.getTestMessageUrl(info)}`);
      console.log(`==================================================\n`);
    }
    return info;
  } catch (error) {
    console.error(`[EmailService] Failed to send OTP to ${toEmail}:`, error.message);
    throw error;
  }
};

/**
 * Sends a confirmation email indicating that the password was changed.
 * 
 * @param {string} toEmail 
 */
export const sendPasswordChangedEmail = async (toEmail) => {
  try {
    const transporter = await getTransporter();
    const mailOptions = {
      from: process.env.SMTP_FROM || '"CampusHub" <no-reply@campushub.edu>',
      to: toEmail,
      subject: 'CampusHub Password Changed Successfully',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
          <div style="text-align: center; border-bottom: 2px solid #198754; padding-bottom: 15px; margin-bottom: 20px;">
            <h2 style="color: #198754; margin: 0; font-size: 26px;">CampusHub Portal</h2>
            <p style="color: #6c757d; margin: 5px 0 0 0; font-size: 14px;">Collaboration & Career Hub</p>
          </div>
          <div style="color: #333333; line-height: 1.6; font-size: 15px;">
            <p>Hello,</p>
            <p>This email is to confirm that your CampusHub account password has been changed successfully.</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #d1e7dd; color: #0f5132; border-radius: 6px; font-weight: bold; text-align: center;">
              Your password was updated on ${new Date().toLocaleString()}
            </div>
            <p>You can now log in to the CampusHub portal with your new credentials.</p>
            <p style="color: #dc3545; font-weight: bold; font-size: 14px;">If you did not make this change, please contact your administration team immediately.</p>
          </div>
          <div style="margin-top: 30px; border-top: 1px solid #e0e0e0; padding-top: 15px; font-size: 12px; color: #888888; text-align: center;">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} CampusHub. All rights reserved.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Password changed confirmation email sent to ${toEmail}`);

    if (testAccount && transporter.options.auth.user === testAccount.user) {
      console.log(`\n==================================================`);
      console.log(`📬 [MOCK EMAIL] Password Reset Confirmation Sent to: ${toEmail}`);
      console.log(`🔗 Click to view preview: ${nodemailer.getTestMessageUrl(info)}`);
      console.log(`==================================================\n`);
    }
  } catch (error) {
    console.error('Failed to send password changed email:', error.message);
  }
};
