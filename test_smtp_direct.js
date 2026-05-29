import nodemailer from "nodemailer";

async function testSMTP() {
  console.log("Initializing SMTP direct test script...");
  
  // Use the exact credentials provided by you
  const transporter = nodemailer.createTransport({
    host: "mail.digicoders.in",
    port: 465,
    secure: true,
    auth: {
      user: "alerts@digicoders.in",
      pass: ")UFCwRvcw]B}WsO."
    },
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 10000,
    socketTimeout: 10000
  });

  const mailOptions = {
    from: '"DigiCoders Alerts" <alerts@digicoders.in>',
    to: "digitalgurucse@gmail.com",
    subject: "SMTP Direct Test Mail - ERP",
    html: `
      <h3>DigiCoders SMTP Direct Test</h3>
      <p>This email has been sent successfully using the direct SMTP test script.</p>
      <p><strong>Configured Details:</strong></p>
      <ul>
        <li>Host: mail.digicoders.in</li>
        <li>Port: 465</li>
        <li>User: alerts@digicoders.in</li>
      </ul>
      <br>
      <p>Regards,<br>DigiCoders Security</p>
    `
  };

  try {
    console.log("Connecting to SMTP mail.digicoders.in:465...");
    let info = await transporter.sendMail(mailOptions);
    console.log("✅ Mail sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (error) {
    console.error("❌ SMTP Direct Test Failed!");
    console.error("Error details:", error);
  }
}

testSMTP();
