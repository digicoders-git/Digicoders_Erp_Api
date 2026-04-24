import Registration from "../models/regsitration.js";
import { sendEmail, sendFeeReminderEmail } from "../utils/sendEmail.js";
import { sendSmsFeeReminder, sendSmsRegReminder } from "../utils/sendSMS.js";

export const sendEmails = async (req, res) => {
  try {
    const { studentId, type, message, subject } = req.body;
    const student = await Registration.findById(studentId);
    if (type === "email") await sendEmail(student.email, subject, message);
    if (type === "sms") await sendEmail(student.email, message);
    if (type === "whatsapp") await sendEmail(student.email, message);
    res
      .status(200)
      .json({ message: "message send successfull", success: true });
  } catch (error) {
    return res.status(500).json({ message: "internal server error" });
  }
};
export const pendingRegistrationFee = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student = await Registration.findById(studentId);

    await sendSmsRegReminder(
      student.mobile,
      student.studentName,
      student.amount,
      student.paymentLink,
    );
    res
      .status(200)
      .json({ message: "message send successfull", success: true });
  } catch (error) {
    console.log(error);

    return res.status(500).json({ message: "internal server error" });
  }
};
export const pendingFees = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Registration.findById(studentId);
    await sendSmsFeeReminder(
      student.mobile,
      student.studentName,
      student.dueAmount,
    );
    res
      .status(200)
      .json({ message: "message send successfull", success: true });
  } catch (error) {
    return res.status(500).json({ message: "internal server error" });
  }
};

export const pendingFeesEmail = async (req, res) => {
  try {
    const { studentId } = req.params;
    const student = await Registration.findById(studentId);
    
    if (student.email) {
      await sendFeeReminderEmail(student.email, {
        studentName: student.studentName,
        amount: student.dueAmount,
        paymentLink: student.paymentLink
      });
    }
    
    res.status(200).json({ message: "Email reminder sent successfully", success: true });
  } catch (error) {
    console.error("Error sending email reminder:", error);
    return res.status(500).json({ message: "internal server error" });
  }
};
