import { sendRegistrationSuccessEmail, sendPaymentReminderEmail, sendPaymentSuccessEmail, sendInstallmentReceivedEmail, sendFeeReminderEmail } from "./utils/sendEmail.js";

const testData = {
    studentName: "Dev Sachin Bhaskar",
    training: "Full Stack Development",
    technology: "MERN Stack",
    totalFee: 15000,
    paidAmount: 5000,
    dueAmount: 10000,
    amount: 5000,
    mobile: "9876543210",
    paymentLink: "https://razorpay.me/testlink",
    paymentId: "pay_XYZ123ABC"
};

const testEmail = "test@example.com";

async function testAll() {
    console.log("Testing emails... (These will actually send if your .env is active)");
    // await sendRegistrationSuccessEmail(testEmail, testData);
    // await sendPaymentReminderEmail(testEmail, testData);
    // await sendPaymentSuccessEmail(testEmail, testData);
    // await sendInstallmentReceivedEmail(testEmail, testData);
    // await sendFeeReminderEmail(testEmail, testData);
    console.log("Test script ready.");
}

testAll();
