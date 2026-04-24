import {
    sendRegistrationSuccessEmail,
    sendPaymentReminderEmail,
    sendPaymentSuccessEmail,
    sendInstallmentReceivedEmail,
    sendFeeReminderEmail
} from "./utils/sendEmail.js";

const testData = {
    studentName: "Dev Krishna Testing",
    training: "Full Stack Development Pro",
    technology: "MERN Stack Advanced",
    totalFee: 15000,
    discount: 2000,
    finalFee: 13000,
    paidAmount: 5000,
    dueAmount: 8000,
    amount: 5000,
    mobile: "9876543210",
    paymentLink: "https://razorpay.me/testpaymentlink2026",
    paymentId: "pay_XYZ123ABC_MERN"
};

// const testEmail = "digitalgurucse@gmail.com";
const testEmail = "krishnarovji@gmail.com";

async function runTests() {
    console.log("Starting email test script...");
    console.log("Sending to: ", testEmail);

    try {
        console.log("1. Sending Registration Success Email...");
        await sendRegistrationSuccessEmail(testEmail, testData);

        console.log("2. Sending Payment Reminder Email...");
        await sendPaymentReminderEmail(testEmail, testData);

        console.log("3. Sending Payment Success Email...");
        await sendPaymentSuccessEmail(testEmail, testData);

        console.log("4. Sending Installment Received Email...");
        await sendInstallmentReceivedEmail(testEmail, testData);

        console.log("5. Sending Fee Reminder Email...");
        await sendFeeReminderEmail(testEmail, testData);

        console.log("All test emails sent successfully (Verify your inbox).");
    } catch (err) {
        console.error("Error during test: ", err);
    }
}

runTests();
