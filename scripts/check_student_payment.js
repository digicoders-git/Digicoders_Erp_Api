import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import Fee from '../models/fee.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const mobile = '6394355806';
    const student = await Registration.findOne({ mobile });

    if (!student) {
      console.log(`❌ Student not found with mobile: ${mobile}`);
      process.exit(0);
    }

    console.log(`\n📋 STUDENT INFO:`);
    console.log(`   ID: ${student._id}`);
    console.log(`   User ID: ${student.userid}`);
    console.log(`   Name: ${student.studentName}`);
    console.log(`   Mobile: ${student.mobile}`);
    console.log(`   Total Fee: ₹${student.totalFee}`);
    console.log(`   Discount: ₹${student.discount}`);
    console.log(`   Final Fee: ₹${student.finalFee}`);
    console.log(`   Paid Amount: ₹${student.paidAmount}`);
    console.log(`   Due Amount: ₹${student.dueAmount}`);
    console.log(`   Fee Status: ${student.trainingFeeStatus}`);

    const fees = await Fee.find({ registrationId: student._id }).sort({ createdAt: 1 });
    console.log(`\n💳 FEE RECORDS (${fees.length}):`);
    fees.forEach((fee, idx) => {
      console.log(`\n   Record #${idx + 1}:`);
      console.log(`      ID: ${fee._id}`);
      console.log(`      Receipt No: ${fee.receiptNo}`);
      console.log(`      Amount: ₹${fee.amount}`);
      console.log(`      Total Fee: ₹${fee.totalFee}`);
      console.log(`      Final Fee: ₹${fee.finalFee}`);
      console.log(`      Paid Amount: ₹${fee.paidAmount}`);
      console.log(`      Due Amount: ₹${fee.dueAmount}`);
      console.log(`      Tnx Status: ${fee.tnxStatus}`);
      console.log(`      Status: ${fee.status}`);
      console.log(`      Payment Type: ${fee.paymentType}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
