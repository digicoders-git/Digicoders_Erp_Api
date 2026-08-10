import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import Registration from '../models/regsitration.js';
import { syncRegistrationFees } from '../helpers/syncFee.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // 1. Correct the fee record's tnxStatus
    const feeRecord = await Fee.findById('6a797e1e9e07b64358386539');
    if (feeRecord) {
      console.log(`Current tnxStatus: ${feeRecord.tnxStatus}`);
      feeRecord.tnxStatus = 'paid';
      await feeRecord.save();
      console.log(`Updated tnxStatus to: ${feeRecord.tnxStatus}`);
    }

    // 2. Sync registration fees to ensure everything is correct
    await syncRegistrationFees('69ec8fe0b5a8cd6392c24e8d');
    
    // 3. Confirm student details
    const student = await Registration.findById('69ec8fe0b5a8cd6392c24e8d');
    console.log(`\nUpdated student details:`);
    console.log(`   Paid: ₹${student.paidAmount}`);
    console.log(`   Due: ₹${student.dueAmount}`);
    console.log(`   Fee Status: ${student.trainingFeeStatus}`);
    console.log(`   Tnx Status: ${student.tnxStatus}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
