import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const checkForDuplicates = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Find all fee records with amount 501
    const fees501 = await Fee.find({ amount: 501 });
    console.log(`\n=== RECORDS WITH AMOUNT 501 ===`);
    console.log(`Found ${fees501.length} records with amount 501:`);
    
    for (const fee of fees501) {
      const registration = await Registration.findById(fee.registrationId);
      console.log(`\nFee ID: ${fee._id}`);
      console.log(`Receipt No: ${fee.receiptNo}`);
      console.log(`Student: ${registration?.studentName || 'Unknown'}`);
      console.log(`Amount: ${fee.amount}`);
      console.log(`Payment Date: ${fee.paymentDate}`);
    }

    // Find all fee records for amounts around 500
    const feesAround500 = await Fee.find({ 
      amount: { $gte: 499, $lte: 502 } 
    }).sort({ amount: 1 });
    
    console.log(`\n=== RECORDS WITH AMOUNTS 499-502 ===`);
    console.log(`Found ${feesAround500.length} records with amounts between 499-502:`);
    
    for (const fee of feesAround500) {
      const registration = await Registration.findById(fee.registrationId);
      console.log(`\nAmount: ${fee.amount} | Receipt: ${fee.receiptNo} | Student: ${registration?.studentName || 'Unknown'}`);
    }

    // Check if there are any fee records with the same receipt number pattern
    const similarReceipts = await Fee.find({ 
      receiptNo: { $regex: /DCTREC-2026-00089[0-9]/ } 
    }).sort({ receiptNo: 1 });
    
    console.log(`\n=== SIMILAR RECEIPT NUMBERS ===`);
    console.log(`Found ${similarReceipts.length} records with similar receipt numbers:`);
    
    for (const fee of similarReceipts) {
      const registration = await Registration.findById(fee.registrationId);
      console.log(`Receipt: ${fee.receiptNo} | Amount: ${fee.amount} | Student: ${registration?.studentName || 'Unknown'}`);
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    process.exit(1);
  }
};

// Run the script
checkForDuplicates();