import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Registration from '../models/regsitration.js';
import Fee from '../models/fee.js';

dotenv.config();

const fixAllDiscrepancies = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to DB');

    console.log('Fetching all valid fee receipts...');
    const validFees = await Fee.find({
      status: { $in: ['new', 'accepted'] }
    });

    const feeMap = new Map();
    validFees.forEach((f) => {
      if (f.registrationId) {
        const regIdStr = f.registrationId.toString();
        const current = feeMap.get(regIdStr) || 0;
        feeMap.set(regIdStr, current + (Number(f.amount) || 0));
      }
    });
    console.log(`Mapped fee receipts for ${feeMap.size} unique registrations.`);

    console.log('Fetching all registrations...');
    const registrations = await Registration.find({});
    console.log(`Analyzing ${registrations.length} total registrations...`);

    let updatedCount = 0;
    let initialDiscrepancyCount = 0;

    for (const student of registrations) {
      const regIdStr = student._id.toString();
      const totalPaidAmount = feeMap.get(regIdStr) || 0;

      const totalFee = Number(student.totalFee || 0);
      const discount = Number(student.discount || 0);
      let finalFee = Number(student.finalFee || Math.max(totalFee - discount, 0));

      // If total paid exceeds finalFee, adjust finalFee to reflect actual total paid
      if (totalPaidAmount > finalFee) {
        finalFee = totalPaidAmount;
      }

      const dueAmount = Math.max(finalFee - totalPaidAmount, 0);

      let newTrainingFeeStatus = 'pending';
      if (totalPaidAmount >= finalFee && finalFee > 0) newTrainingFeeStatus = 'full paid';
      else if (totalPaidAmount > 0) newTrainingFeeStatus = 'partial';

      let newTnxStatus = 'pending';
      if (totalPaidAmount >= finalFee && finalFee > 0) newTnxStatus = 'full paid';
      else if (totalPaidAmount > 0) newTnxStatus = 'paid';

      // Check if any field needs updating
      const needsUpdate = 
        student.paidAmount !== totalPaidAmount ||
        student.dueAmount !== dueAmount ||
        student.finalFee !== finalFee ||
        student.trainingFeeStatus !== newTrainingFeeStatus ||
        student.tnxStatus !== newTnxStatus;

      if (Math.abs((Number(student.paidAmount || 0) + Number(student.dueAmount || 0)) - Number(student.finalFee || 0)) > 0.01) {
        initialDiscrepancyCount++;
      }

      if (needsUpdate) {
        student.paidAmount = totalPaidAmount;
        student.dueAmount = dueAmount;
        student.finalFee = finalFee;
        student.trainingFeeStatus = newTrainingFeeStatus;
        student.tnxStatus = newTnxStatus;
        await student.save();
        updatedCount++;
      }
    }

    console.log(`\n📊 FIX SUMMARY:`);
    console.log(`- Initial Discrepancies Detected: ${initialDiscrepancyCount}`);
    console.log(`- Student Records Updated: ${updatedCount}`);

    // Re-verify entire database after fix
    const verifyRegistrations = await Registration.find({});
    let totalFinalFee = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let remainingDiscrepancies = 0;

    verifyRegistrations.forEach((s) => {
      const finalFee = Number(s.finalFee || 0);
      const paid = Number(s.paidAmount || 0);
      const due = Number(s.dueAmount || 0);

      totalFinalFee += finalFee;
      totalPaid += paid;
      totalDue += due;

      if (Math.abs((paid + due) - finalFee) > 0.01) {
        remainingDiscrepancies++;
      }
    });

    console.log(`\n✅ POST-FIX VERIFICATION:`);
    console.log(`- Total Final Fee: ₹${totalFinalFee.toLocaleString('en-IN')}`);
    console.log(`- Total Paid: ₹${totalPaid.toLocaleString('en-IN')}`);
    console.log(`- Total Due: ₹${totalDue.toLocaleString('en-IN')}`);
    console.log(`- Total Paid + Total Due: ₹${(totalPaid + totalDue).toLocaleString('en-IN')}`);
    console.log(`- Remaining Discrepancies: ${remainingDiscrepancies}`);

    if (remainingDiscrepancies === 0) {
      console.log(`🎉 ALL FEE DISCREPANCIES RESOLVED PERFECTLY!`);
    } else {
      console.log(`⚠️ Warning: ${remainingDiscrepancies} discrepancies still remain.`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error executing fixAllDiscrepancies:', error);
    process.exit(1);
  }
};

fixAllDiscrepancies();
