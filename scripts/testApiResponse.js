import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const testApiResponse = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Find Kanhaiya Singh's fee record
    const feeRecord = await Fee.findOne({ receiptNo: 'DCTREC-2026-000895' });

    if (!feeRecord) {
      console.log('Fee record not found');
      return;
    }

    // Get the registration separately
    const registration = await Registration.findById(feeRecord.registrationId);

    console.log('\n=== API RESPONSE SIMULATION ===');
    console.log('This is the basic fee record data:');
    console.log(JSON.stringify({
      success: true,
      message: "feaching successfull",
      data: {
        _id: feeRecord._id,
        amount: feeRecord.amount,
        receiptNo: feeRecord.receiptNo,
        paymentDate: feeRecord.paymentDate,
        status: feeRecord.status,
        tnxStatus: feeRecord.tnxStatus,
        registrationId: registration ? {
          studentName: registration.studentName,
          mobile: registration.mobile
        } : null
      }
    }, null, 2));

    console.log('\n=== KEY VALUES ===');
    console.log(`Amount: ${feeRecord.amount} (Type: ${typeof feeRecord.amount})`);
    console.log(`Receipt No: ${feeRecord.receiptNo}`);
    console.log(`Student Name: ${registration?.studentName}`);
    console.log(`Payment Date: ${feeRecord.paymentDate}`);
    console.log(`Status: ${feeRecord.status}`);
    console.log(`Tnx Status: ${feeRecord.tnxStatus}`);

    // Test the exact calculation that might be happening in frontend
    console.log('\n=== POTENTIAL CALCULATIONS ===');
    console.log(`Amount + 1: ${Number(feeRecord.amount) + 1}`);
    console.log(`Amount as string + 1: ${feeRecord.amount + 1}`);
    console.log(`Amount parsed: ${parseInt(feeRecord.amount)}`);
    console.log(`Amount with Math.ceil: ${Math.ceil(feeRecord.amount)}`);
    console.log(`Amount with Math.floor: ${Math.floor(feeRecord.amount)}`);

    // Disconnect
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
    
  } catch (error) {
    console.error('Error testing API response:', error);
    process.exit(1);
  }
};

// Run the script
testApiResponse();