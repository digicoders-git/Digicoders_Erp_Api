import dotenv from 'dotenv';
dotenv.config();

import { sendSmsCertificateForm } from './utils/sendSMS.js';
import mongoose from 'mongoose';
import Registration from './models/regsitration.js';

const testSms = async () => {
  try {
    console.log("Sending test SMS to 9696559848...");
    const res = await sendSmsCertificateForm('9696559848', 'Student');
    console.log("Test SMS Response:", res);
  } catch (error) {
    console.error("Test SMS Error:", error);
  }
};

const sendToAll = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB.");

    const students = await Registration.find({ status: { $in: ['accepted', 'new'] } }).select('mobile studentName');
    console.log(`Found ${students.length} students to send SMS.`);

    // For loop with delay to avoid rate limit
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      if (student.mobile && student.mobile.length === 10) {
        console.log(`Sending SMS to ${student.studentName} (${student.mobile})...`);
        try {
          const res = await sendSmsCertificateForm(student.mobile, student.studentName);
          console.log(`Response for ${student.mobile}:`, res);
        } catch (err) {
          console.error(`Error sending to ${student.mobile}:`, err.message);
        }
        
        // Delay of 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    console.log("Finished sending SMS to all students.");
    process.exit(0);
  } catch (error) {
    console.error("Error connecting to DB:", error);
    process.exit(1);
  }
};

const run = async () => {
  const mode = process.argv[2];
  if (mode === 'test') {
    await testSms();
    process.exit(0);
  } else if (mode === 'all') {
    await sendToAll();
  } else {
    console.log("Please provide mode: 'test' or 'all'");
    process.exit(1);
  }
};

run();
