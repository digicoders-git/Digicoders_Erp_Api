import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const fixFeeAmounts = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Find all fee records
    const fees = await Fee.find({}).populate('registrationId');
    
    console.log(`Found ${fees.length} fee records to check`);
    
    let fixedCount = 0;
    
    for (const fee of fees) {
      // Check if amount is a string or has any issues
      const originalAmount = fee.amount;
      const numericAmount = Number(originalAmount);
      
      if (isNaN(numericAmount) || originalAmount !== numericAmount) {
        console.log(`Fixing fee record ${fee._id}: ${originalAmount} -> ${numericAmount}`);
        
        fee.amount = numericAmount;
        await fee.save();
        fixedCount++;
      }
      
      // Also check for specific case where amount might be off by 1
      if (fee.registrationId && fee.registrationId.studentName === 'Kanhaiya Singh') {
        console.log(`Found Kanhaiya Singh's record:`, {
          receiptNo: fee.receiptNo,
          amount: fee.amount,
          paymentDate: fee.paymentDate
        });
      }
    }
    
    console.log(`Fixed ${fixedCount} fee records`);
    
    // Disconnect
    await mongoose.disconnect();
    console.log('Disconnected from database');
    
  } catch (error) {
    console.error('Error fixing fee amounts:', error);
    process.exit(1);
  }
};

// Run the script
fixFeeAmounts();