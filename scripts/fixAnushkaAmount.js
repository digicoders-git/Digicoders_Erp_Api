import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const fixAnushkaAmount = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Find Anushka Saini's fee record with amount 501
    const anushkaFee = await Fee.findOne({ 
      receiptNo: 'DCTREC-2026-000894',
      amount: 501 
    });

    if (!anushkaFee) {
      console.log('Anushka Saini fee record with amount 501 not found');
      return;
    }

    // Get registration details
    const registration = await Registration.findById(anushkaFee.registrationId);
    
    console.log('\n=== BEFORE UPDATE ===');
    console.log(`Student: ${registration?.studentName}`);
    console.log(`Receipt No: ${anushkaFee.receiptNo}`);
    console.log(`Current Amount: ${anushkaFee.amount}`);
    console.log(`Registration Paid Amount: ${registration?.paidAmount}`);
    console.log(`Registration Due Amount: ${registration?.dueAmount}`);

    // Update fee amount from 501 to 500
    const oldAmount = anushkaFee.amount;
    const newAmount = 500;
    const difference = oldAmount - newAmount; // 1

    // Update fee record
    anushkaFee.amount = newAmount;
    await anushkaFee.save();

    // Update registration amounts if the fee was already accepted
    if (anushkaFee.status === 'accepted' && registration) {
      // Reduce paid amount by the difference (1)
      registration.paidAmount = Math.max(Number(registration.paidAmount) - difference, 0);
      // Increase due amount by the difference (1)
      registration.dueAmount = Number(registration.dueAmount) + difference;
      
      await registration.save();
      
      console.log('\n=== REGISTRATION UPDATED ===');
      console.log(`New Paid Amount: ${registration.paidAmount}`);
      console.log(`New Due Amount: ${registration.dueAmount}`);
    }

    console.log('\n=== AFTER UPDATE ===');
    console.log(`Student: ${registration?.studentName}`);
    console.log(`Receipt No: ${anushkaFee.receiptNo}`);
    console.log(`New Amount: ${anushkaFee.amount}`);
    console.log(`✅ Successfully updated amount from ₹${oldAmount} to ₹${newAmount}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
    
  } catch (error) {
    console.error('Error fixing Anushka amount:', error);
    process.exit(1);
  }
};

// Run the script
fixAnushkaAmount();