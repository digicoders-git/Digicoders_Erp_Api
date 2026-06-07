import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const getEnvString = (val, fallback) => {
  if (!val) return fallback;
  const trimmed = val.trim();
  return trimmed === "" ? fallback : trimmed;
};

// Create transporter helper
const createTransporter = (port, secure) => {
  return nodemailer.createTransport({
    host: getEnvString(process.env.EMAIL_HOST, "mail.digicoders.in"),
    port: port,
    secure: secure,
    auth: {
      user: getEnvString(process.env.EMAIL_USER, "alerts@digicoders.in"),
      pass: getEnvString(process.env.EMAIL_PASS, "Zxi{n@^Q;@=Z?tIa")
    },
    tls: {
      rejectUnauthorized: false // bypass SSL verification issues common with custom SMTP domains
    },
    connectionTimeout: 4000, // Fail fast (4s) so fallback can be attempted quickly
    greetingTimeout: 4000,
    socketTimeout: 4000
  });
};

// Create secure (port 465) and STARTTLS (port 587) transporters once at module level
const secureTransporter = createTransporter(465, true);
const starttlsTransporter = createTransporter(587, false);

export const sendEmail = async (to, subject, html) => {
  // Execute email sending asynchronously in the background so it never blocks HTTP responses
  // and prevents frontend / user client timeout errors.
  Promise.resolve().then(async () => {
    const envPort = parseInt(process.env.EMAIL_PORT) || 465;
    const isSecure = process.env.SMTP_SECURE !== 'false';

    let primaryTransporter;
    let fallbackTransporter;

    if (envPort === 587 || !isSecure) {
      primaryTransporter = starttlsTransporter;
      fallbackTransporter = secureTransporter;
    } else {
      primaryTransporter = secureTransporter;
      fallbackTransporter = starttlsTransporter;
    }

    try {
      await primaryTransporter.sendMail({
        from: `"DigiCoders Technologies" <${getEnvString(process.env.EMAIL_USER, "alerts@digicoders.in")}>`,
        to,
        subject,
        html,
      });
      console.log("✅ Email sent to:", to);
    } catch (err) {
      console.warn(`⚠️ [SMTP] Primary connection failed: ${err.message}. Trying fallback transport...`);
      try {
        await fallbackTransporter.sendMail({
          from: `"DigiCoders Technologies" <${getEnvString(process.env.EMAIL_USER, "alerts@digicoders.in")}>`,
          to,
          subject,
          html,
        });
        console.log("✅ Email sent via fallback to:", to);
      } catch (fallbackErr) {
        console.error("❌ [SMTP] Email sending failed completely (both primary and fallback failed):", fallbackErr);
      }
    }
  });
};

const getBaseTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin: 0; padding: 0; color: #333333;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9f9f9; padding: 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e0e0e0; border-top: 4px solid #0046b8;">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px 20px 40px; text-align: left; border-bottom: 1px solid #eeeeee;">
              <h1 style="color: #0046b8; margin: 0; font-size: 24px; font-weight: normal;">DigiCoders Technologies</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 40px; color: #333333; font-size: 14px; line-height: 1.6;">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #fcfcfc; padding: 20px 40px; text-align: left; border-top: 1px solid #eeeeee;">
              <p style="margin: 0 0 10px 0; color: #666666; font-size: 12px; line-height: 1.5;">
                <strong>DigiCoders Technologies Pvt. Ltd.</strong><br>
                This is an automated correspondence. Please do not reply directly to this email.<br>
                For any queries, contact our support team at <a href="mailto:info@thedigicoders.com" style="color: #0046b8; text-decoration: none;">info@thedigicoders.com</a> or call +91-9198483820.
              </p>
              <p style="margin: 0; color: #999999; font-size: 11px;">
                &copy; ${new Date().getFullYear()} DigiCoders Technologies Pvt. Ltd. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const sendRegistrationSuccessEmail = async (to, data) => {
  const content = `
    <p style="margin-top: 0;">Dear <strong>${data.studentName}</strong>,</p>
    <p>Greetings from DigiCoders Technologies.</p>
    <p>We are pleased to confirm your registration for our professional training program. Welcome to DigiCoders.</p>
    
    <div style="margin: 25px 0; border: 1px solid #eeeeee; padding: 20px; background-color: #fafafa;">
      <h3 style="margin: 0 0 15px 0; color: #0046b8; font-size: 14px; text-transform: uppercase;">Registration Summary</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr><td style="padding: 5px 0; color: #666666; width: 40%;">Training Program:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">${data.training}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Applied Technology:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">${data.technology}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Total Course Fee:</td><td style="padding: 5px 0; color: #333333;">₹${data.totalFee}</td></tr>
        ${data.discount ? `<tr><td style="padding: 5px 0; color: #666666;">Scholarship/Discount:</td><td style="padding: 5px 0; color: #333333; color: #43a047;">- ₹${data.discount}</td></tr>` : ''}
        <tr><td style="padding: 8px 0; border-top: 1px solid #eeeeee; color: #666666;">Final Net Fee:</td><td style="padding: 8px 0; border-top: 1px solid #eeeeee; color: #333333; font-weight: bold;">₹${data.finalFee}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Amount Paid Now:</td><td style="padding: 5px 0; color: #333333; font-weight: bold; color: #1e88e5;">₹${data.paidAmount}</td></tr>
        ${data.dueAmount ? `<tr><td style="padding: 5px 0; color: #666666;">Pending Balance:</td><td style="padding: 5px 0; color: #333333; font-weight: bold; color: #e53935;">₹${data.dueAmount}</td></tr>` : ''}
      </table>
    </div>

    <p style="margin-bottom: 15px;"><strong>Student Portal Login Credentials:</strong></p>
    <div style="background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
      <p style="margin: 0; font-size: 14px;">
        <strong>URL:</strong> <a href="https://student.thedigicoders.com/" style="color: #0046b8;">student.thedigicoders.com</a><br>
        <strong>Username:</strong> ${data.mobile}<br>
        <strong>Password:</strong> ${data.mobile} (Your Mobile Number)
      </p>
    </div>
    
    <p>We wish you a successful learning journey ahead.</p>
    <p style="margin: 0;">Sincerely,</p>
    <p style="margin: 5px 0 0 0;"><strong>Admissions Team</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, "Registration Confirmation - DigiCoders Technologies", getBaseTemplate("Registration Confirmation", content));
};

export const sendPaymentReminderEmail = async (to, data) => {
  const content = `
    <p style="margin-top: 0;">Dear <strong>${data.studentName}</strong>,</p>
    <p>We note that your registration profile has been created; however, your seat confirmation is pending due to an incomplete registration fee payment.</p>
    
    <div style="margin: 25px 0; border: 1px solid #eeeeee; padding: 20px; background-color: #fafafa;">
      <h3 style="margin: 0 0 15px 0; color: #0046b8; font-size: 14px; text-transform: uppercase;">Payment Details</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr><td style="padding: 5px 0; color: #666666; width: 40%;">Training Program:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">${data.training}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Technology:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">${data.technology}</td></tr>
        <tr><td style="padding: 10px 0 5px 0; border-top: 1px solid #e0e0e0; color: #666666; margin-top: 5px;">Pending Amount:</td><td style="padding: 10px 0 5px 0; border-top: 1px solid #e0e0e0; color: #333333; font-weight: bold; margin-top: 5px;">₹${data.amount}</td></tr>
      </table>
    </div>

    ${data.paymentLink ? `
      <p style="margin: 30px 0;">
        <a href="${data.paymentLink}" style="background-color: #0046b8; color: #ffffff; padding: 10px 20px; font-size: 14px; text-decoration: none; border-radius: 3px; display: inline-block;">Complete Payment</a>
      </p>
    ` : ''}
    
    <p>Kindly proceed with the payment at your earliest convenience to secure your enrollment. Should you require any assistance, please do not hesitate to contact our administrative desk.</p>
    
    <p style="margin: 0;">Sincerely,</p>
    <p style="margin: 5px 0 0 0;"><strong>Accounts Department</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, "Action Required: Registration Payment Pending - DigiCoders", getBaseTemplate("Pending Payment Notification", content));
};

export const sendPaymentSuccessEmail = async (to, data) => {
  const content = `
    <p style="margin-top: 0;">Dear <strong>${data.studentName}</strong>,</p>
    <p>This email serves to formally acknowledge the receipt of your payment.</p>
    
    <div style="margin: 25px 0; border: 1px solid #eeeeee; padding: 20px; background-color: #fafafa;">
      <h3 style="margin: 0 0 15px 0; color: #0046b8; font-size: 14px; text-transform: uppercase;">Payment Receipt</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr><td style="padding: 5px 0; color: #666666; width: 40%;">Transaction ID:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">${data.paymentId}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Amount Received:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">₹${data.amount}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Payment Status:</td><td style="padding: 5px 0; color: #333333;">Successful</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Training Program:</td><td style="padding: 5px 0; color: #333333;">${data.training}</td></tr>
        ${data.technology ? `<tr><td style="padding: 5px 0; color: #666666;">Technology:</td><td style="padding: 5px 0; color: #333333;">${data.technology}</td></tr>` : ''}
      </table>
    </div>
    
    ${data.mobile ? `
    <p style="margin-bottom: 15px;"><strong>Student Portal Login Details:</strong></p>
    <div style="background-color: #e3f2fd; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
      <p style="margin: 0; font-size: 14px;">
        <strong>URL:</strong> <a href="https://student.thedigicoders.com/" style="color: #0046b8;">student.thedigicoders.com</a><br>
        <strong>Username:</strong> ${data.mobile}<br>
        <strong>Password:</strong> ${data.mobile}
      </p>
    </div>` : ''}

    <p>Thank you for your prompt payment.</p>

    <p style="margin: 0;">Sincerely,</p>
    <p style="margin: 5px 0 0 0;"><strong>Accounts Department</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, "Payment Receipt Confirmed - DigiCoders", getBaseTemplate("Payment Receipt", content));
};

export const sendInstallmentReceivedEmail = async (to, data) => {
  const content = `
    <p style="margin-top: 0;">Dear <strong>${data.studentName}</strong>,</p>
    <p>This email is to formally acknowledge the receipt of your recent fee installment payment for your ongoing training program.</p>
    
    <div style="margin: 25px 0; border: 1px solid #eeeeee; padding: 20px; background-color: #fafafa;">
      <h3 style="margin: 0 0 15px 0; color: #0046b8; font-size: 14px; text-transform: uppercase;">Transaction Snapshot</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr><td style="padding: 5px 0; color: #666666; width: 60%;">Amount Received:</td><td style="padding: 5px 0; color: #333333; font-weight: bold; text-align: right;">₹${data.amount}</td></tr>
        <tr><td style="padding: 10px 0 5px 0; border-top: 1px solid #e0e0e0; color: #666666; margin-top: 5px;">Remaining Balance:</td><td style="padding: 10px 0 5px 0; border-top: 1px solid #e0e0e0; color: #333333; font-weight: bold; text-align: right; margin-top: 5px;">${data.dueAmount ? `₹${data.dueAmount}` : 'Nil'}</td></tr>
      </table>
    </div>

    <p>We appreciate your attention to maintaining your account up to date. Should you have any questions or require further clarification, please contact our office.</p>

    <p style="margin: 0;">Sincerely,</p>
    <p style="margin: 5px 0 0 0;"><strong>Accounts Department</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, "Installment Payment Received - DigiCoders", getBaseTemplate("Installment Receipt", content));
};

export const sendFeeReminderEmail = async (to, data) => {
  const content = `
    <p style="margin-top: 0;">Dear <strong>${data.studentName}</strong>,</p>
    <p>This is a formal reminder regarding the outstanding fee for your ongoing training program at <strong>DigiCoders Technologies</strong>.</p>
    
    <div style="margin: 25px 0; border: 1px solid #eeeeee; padding: 20px; background-color: #fafafa;">
      <p style="margin: 0 0 5px 0; color: #666666; font-size: 14px; text-transform: uppercase;">Total Outstanding Dues</p>
      <h3 style="margin: 0; color: #333333; font-size: 20px;">₹${data.amount}</h3>
    </div>

    ${data.paymentLink ? `
      <p style="margin: 30px 0;">
        <a href="${data.paymentLink}" style="background-color: #0046b8; color: #ffffff; padding: 10px 20px; font-size: 14px; text-decoration: none; border-radius: 3px; display: inline-block;">Clear Outstanding Dues</a>
      </p>
    ` : ''}
    
    <p>We request you to kindly process the pending payment at the earliest. If you have already remitted the amount recently, please disregard this automated notification; your account will reflect the update shortly.</p>
    
    <p style="margin: 0;">Sincerely,</p>
    <p style="margin: 5px 0 0 0;"><strong>Accounts Department</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, "Outstanding Fee Reminder - DigiCoders", getBaseTemplate("Fee Reminder", content));
};

export const sendOTPEmail = async (to, data) => {
  const isAdmin = data.userInfo && data.userInfo.name;
  
  const content = `
    <p style="margin-top: 0;">${isAdmin ? `Dear <strong>${data.userInfo.name}</strong>,` : 'Dear User,'}</p>
    <p>${isAdmin 
      ? 'A login request has been initiated for your Admin account. Please use the following One-Time Password (OTP) to complete your secure login:'
      : 'You have requested to access your account. Please use the following One-Time Password (OTP) to complete your login:'}</p>
    
    <div style="margin: 30px 0; text-align: center; background-color: #f8f9fa; padding: 25px; border-radius: 8px; border: 2px dashed #0046b8;">
      <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">${isAdmin ? 'Admin Login OTP' : 'Your OTP Code'}</p>
      <h2 style="margin: 0; color: #0046b8; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${data.otp}</h2>
    </div>

    ${isAdmin ? `
    <div style="background-color: #e3f2fd; border: 1px solid #90caf9; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #0d47a1; font-size: 13px;">
        <strong>📧 Admin Security:</strong> This login attempt was made at ${data.userInfo.loginTime}. If this was not you, please contact the Super Admin immediately.
      </p>
    </div>
    ` : ''}

    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 13px;">
        <strong>⚠️ Security Notice:</strong> This OTP is valid for 5 minutes only. Do not share this code with anyone for security reasons.
      </p>
    </div>

    <p>If you did not request this OTP, please ignore this email or contact our support team immediately.</p>

    <p style="margin: 0;">Regards,</p>
    <p style="margin: 5px 0 0 0;"><strong>${isAdmin ? 'Admin Security Team' : 'Security Team'}</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, `${isAdmin ? '🔐 Admin ' : ''}Login OTP - DigiCoders Technologies`, getBaseTemplate("Login Verification", content));
};

export const sendLoginAlertEmail = async (to, data) => {
  const isAdmin = data.isAdmin || false;
  
  const content = `
    <p style="margin-top: 0;">Dear ${isAdmin ? 'Admin' : 'Security Team'},</p>
    <p>${isAdmin 
      ? 'Your Admin account has been successfully accessed. Below are the login details for your records:'
      : 'A new login attempt has been detected on the DigiCoders ERP System.'}</p>
    
    <div style="margin: 25px 0; border: 1px solid #eeeeee; padding: 20px; background-color: #fafafa;">
      <h3 style="margin: 0 0 15px 0; color: #0046b8; font-size: 14px; text-transform: uppercase;">${isAdmin ? 'Admin Login Confirmation' : 'Login Details'}</h3>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 14px;">
        <tr><td style="padding: 5px 0; color: #666666; width: 30%;">Account:</td><td style="padding: 5px 0; color: #333333; font-weight: bold;">${data.email}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">Login Time:</td><td style="padding: 5px 0; color: #333333;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td></tr>
        <tr><td style="padding: 5px 0; color: #666666;">IP Address:</td><td style="padding: 5px 0; color: #333333;">${data.ip}</td></tr>
        ${data.location ? `<tr><td style="padding: 5px 0; color: #666666;">Location:</td><td style="padding: 5px 0; color: #333333;">${data.location}</td></tr>` : ''}
        ${data.userAgent ? `<tr><td style="padding: 5px 0; color: #666666;">Device Info:</td><td style="padding: 5px 0; color: #333333; font-size: 12px;">${data.userAgent}</td></tr>` : ''}
      </table>
    </div>

    ${isAdmin ? `
    <div style="background-color: #e8f5e8; border: 1px solid #4caf50; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #2e7d32; font-size: 13px;">
        <strong>✅ Security Status:</strong> Login successful. If this was not you, please change your password immediately and contact the Super Admin.
      </p>
    </div>
    ` : ''}

    <p>${isAdmin 
      ? 'This is an automated security confirmation for your Admin account access.'
      : 'This is an automated security notification. If this login attempt was not authorized, please take immediate action.'}</p>

    <p style="margin: 0;">Regards,</p>
    <p style="margin: 5px 0 0 0;"><strong>${isAdmin ? 'Admin Security System' : 'Security System'}</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, `${isAdmin ? '🔓 Admin Login Confirmation' : '🔐 Login Alert'} - DigiCoders ERP`, getBaseTemplate("Security Alert", content));
};

export const sendExportOTPEmail = async (to, data) => {
  const content = `
    <p style="margin-top: 0;">Dear User,</p>
    <p>We received a request to export student data from the DigiCoders ERP system. Please use the following One-Time Password (OTP) to verify your request and start the download:</p>
    
    <div style="margin: 30px 0; text-align: center; background-color: #f8f9fa; padding: 25px; border-radius: 8px; border: 2px dashed #0046b8;">
      <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Export OTP Code</p>
      <h2 style="margin: 0; color: #0046b8; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${data.otp}</h2>
    </div>

    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <p style="margin: 0; color: #856404; font-size: 13px;">
        <strong>⚠️ Security Notice:</strong> This OTP is valid for 10 minutes only. Do not share this code with anyone. If you did not initiate this request, please change your password or contact the system administrator immediately.
      </p>
    </div>

    <p>Regards,</p>
    <p style="margin: 5px 0 0 0;"><strong>Security Team</strong><br>DigiCoders Technologies Pvt. Ltd.</p>
  `;
  await sendEmail(to, "Student Data Export OTP - DigiCoders Technologies", getBaseTemplate("Data Export Verification", content));
};

