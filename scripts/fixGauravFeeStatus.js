import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const fixGauravFeeStatus = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Find Gaurav Gupta
    const gaurav = await Registration.findOne({ userid: "DCT-2026-0123" });
    
    if (!gaurav) {
      console.log('❌ Gaurav Gupta not found');
      process.exit(1);
    }
    
    console.log('📊 Current Status:');
    console.log(`Total Fee: ₹${gaurav.totalFee}`);
    console.log(`Final Fee: ₹${gaurav.finalFee}`);
    console.log(`Paid Amount: ₹${gaurav.paidAmount}`);
    console.log(`Due Amount: ₹${gaurav.dueAmount}`);
    console.log(`Training Fee Status: ${gaurav.trainingFeeStatus}`);
    console.log(`Transaction Status: ${gaurav.tnxStatus}`);
    
    // Calculate correct due amount
    const paidAmount = gaurav.paidAmount || 0;
    const finalFee = gaurav.finalFee || 0;
    const correctDueAmount = Math.max(finalFee - paidAmount, 0);
    
    console.log(`\n🧮 Calculation:`);
    console.log(`Final Fee (${finalFee}) - Paid Amount (${paidAmount}) = Due Amount (${correctDueAmount})`);
    
    // Calculate correct status
    let correctTrainingFeeStatus, correctTnxStatus;
    
    if (paidAmount >= finalFee) {
      correctTrainingFeeStatus = "full paid";
      correctTnxStatus = "full paid";
    } else if (paidAmount > 0) {
      correctTrainingFeeStatus = "partial";
      correctTnxStatus = "paid";
    } else {
      correctTrainingFeeStatus = "pending";
      correctTnxStatus = "pending";
    }
    
    console.log('\n🔧 Correct Values Should Be:');
    console.log(`Due Amount: ₹${correctDueAmount}`);
    console.log(`Training Fee Status: ${correctTrainingFeeStatus}`);
    console.log(`Transaction Status: ${correctTnxStatus}`);
    
    // Update if needed
    let needsUpdate = false;
    
    if (gaurav.dueAmount !== correctDueAmount) {
      gaurav.dueAmount = correctDueAmount;
      needsUpdate = true;
    }
    
    if (gaurav.trainingFeeStatus !== correctTrainingFeeStatus) {
      gaurav.trainingFeeStatus = correctTrainingFeeStatus;
      needsUpdate = true;
    }
    
    if (gaurav.tnxStatus !== correctTnxStatus) {
      gaurav.tnxStatus = correctTnxStatus;
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      await gaurav.save();
      console.log('\n✅ All Values Updated Successfully!');
    } else {
      console.log('\n✅ All values are already correct!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

fixGauravFeeStatus();