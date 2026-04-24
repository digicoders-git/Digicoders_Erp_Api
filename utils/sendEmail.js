import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const sendEmail = async (to, subject, html) => {
  try {
    // const transporter = nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: process.env.EMAIL_PORT,
    //   secure: process.env.SMTP_SECURE === 'true',
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   },
    // });
    const transporter = nodemailer.createTransport({
      host: "mail.digicoders.in",
      port: 465,
      secure: true,
      auth: {
        user: "alerts@digicoders.in",
        pass: "bCFB^]J.HmXF154A"
      }
    });
    await transporter.sendMail({
      from: `"DigiCoders Technologies" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent to:", to);
  } catch (err) {
    console.error("❌ Email sending failed:", err);
  }
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
