import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const checkKanhaiyaRecords = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Find Kanhaiya Singh's registration records
    const registrations = await Registration.find({
      studentName: { $regex: /kanhaiya/i }
    });
    
    console.log(`\n=== KANHAIYA SINGH REGISTRATION RECORDS ===`);
    console.log(`Found ${registrations.length} registration records:`);
    
    for (const reg of registrations) {
      console.log(`\nRegistration ID: ${reg._id}`);
      console.log(`Student Name: ${reg.studentName}`);
      console.log(`User ID: ${reg.userid}`);
      console.log(`Mobile: ${reg.mobile}`);
      console.log(`Total Fee: ${reg.totalFee}`);
      console.log(`Final Fee: ${reg.finalFee}`);
      console.log(`Paid Amount: ${reg.paidAmount}`);
      console.log(`Due Amount: ${reg.dueAmount}`);
      console.log(`Training Fee Status: ${reg.trainingFeeStatus}`);
      
      // Find all fee records for this registration
      const fees = await Fee.find({ registrationId: reg._id }).sort({ createdAt: -1 });
      
      console.log(`\n--- FEE RECORDS FOR THIS REGISTRATION (${fees.length} records) ---`);
      
      for (const fee of fees) {
        console.log(`\nFee ID: ${fee._id}`);
        console.log(`Receipt No: ${fee.receiptNo}`);
        console.log(`Amount: ${fee.amount} (Type: ${typeof fee.amount})`);
        console.log(`Payment Type: ${fee.paymentType}`);
        console.log(`Mode: ${fee.mode}`);
        console.log(`Status: ${fee.status}`);
        console.log(`Tnx Status: ${fee.tnxStatus}`);
        console.log(`Payment Date: ${fee.paymentDate}`);
        console.log(`Created At: ${fee.createdAt}`);
        
        // Check if this is the specific receipt mentioned
        if (fee.receiptNo === 'DCTREC-2026-000895') {
          console.log(`\n🎯 THIS IS THE RECEIPT IN QUESTION!`);
          console.log(`Raw amount value: ${JSON.stringify(fee.amount)}`);
          console.log(`Amount as number: ${Number(fee.amount)}`);
          console.log(`Amount + 1: ${Number(fee.amount) + 1}`);
        }
      }
      
      console.log(`\n${'='.repeat(60)}`);
    }
    
    // Also search by mobile number if provided
    console.log(`\n=== SEARCHING BY MOBILE/EMAIL ===`);
    const mobileSearch = await Registration.find({
      $or: [
        { mobile: { $regex: /9140967607|6394296293/i } },
        { email: { $regex: /kanhaiya/i } }
      ]
    });
    
    if (mobileSearch.length > 0) {
      console.log(`Found ${mobileSearch.length} additional records by mobile/email`);
      for (const reg of mobileSearch) {
        if (!registrations.find(r => r._id.toString() === reg._id.toString())) {
          console.log(`Additional record: ${reg.studentName} - ${reg.mobile}`);
        }
      }
    }
    
    // Disconnect
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
    
  } catch (error) {
    console.error('Error checking records:', error);
    process.exit(1);
  }
};

// Run the script
checkKanhaiyaRecords();