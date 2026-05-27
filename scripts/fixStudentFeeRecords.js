import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import Fee from '../models/fee.js';
import TechnologyModal from '../models/technology.js';
import TranningModal from '../models/tranning.js';
import BranchModal from '../models/branch.js';
import manageHr from '../models/manageHr.js';
import QrCode from '../models/qrCode.js';
import dotenv from 'dotenv';

dotenv.config();

const fixStudentFeeRecords = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const studentsToFix = [
      { name: 'Akanksha Rai', userid: 'DCT-2026-0050' },
      { name: 'Mohini Pandey', userid: 'DCT-2026-0045' }
    ];
    
    for (const studentInfo of studentsToFix) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`FIXING RECORDS FOR: ${studentInfo.name} (${studentInfo.userid})`);
      console.log(`${'='.repeat(60)}`);
      
      // Find student registration record
      const student = await Registration.findOne({ userid: studentInfo.userid });
      
      if (!student) {
        console.log(`❌ Student not found with ID: ${studentInfo.userid}`);
        continue;
      }
      
      console.log(`📋 Found student: ${student.studentName}`);
      
      // Find all fee records for this student
      const feeRecords = await Fee.find({ registrationId: student._id })
        .sort({ createdAt: 1 });
      
      console.log(`💳 Found ${feeRecords.length} fee payment records`);
      
      // Calculate correct totals from fee records
      let totalPaidFromFees = 0;
      let validFeeRecords = [];
      
      feeRecords.forEach((fee, index) => {
        console.log(`\n   Payment #${index + 1}:`);
        console.log(`      Amount: ₹${fee.amount || 0}`);
        console.log(`      Status: ${fee.status || 'N/A'}`);
        console.log(`      Tnx Status: ${fee.tnxStatus || 'N/A'}`);
        console.log(`      Date: ${fee.createdAt}`);
        
        // Only count paid/accepted payments
        if (fee.tnxStatus === 'paid' || fee.status === 'accepted') {
          totalPaidFromFees += (fee.amount || 0);
          validFeeRecords.push(fee);
          console.log(`      ✅ Counted: ₹${fee.amount || 0}`);
        } else {
          console.log(`      ❌ Not counted (status: ${fee.status}, tnx: ${fee.tnxStatus})`);
        }
      });
      
      console.log(`\n📊 CURRENT vs CALCULATED:`);
      console.log(`   Current Paid Amount: ₹${student.paidAmount || 0}`);
      console.log(`   Calculated from Fees: ₹${totalPaidFromFees}`);
      console.log(`   Final Fee: ₹${student.finalFee || 0}`);
      
      // Calculate new due amount
      const newDueAmount = Math.max((student.finalFee || 0) - totalPaidFromFees, 0);
      
      console.log(`   New Due Amount: ₹${newDueAmount}`);
      
      // Determine training fee status
      let newTrainingFeeStatus = 'pending';
      if (totalPaidFromFees >= (student.finalFee || 0)) {
        newTrainingFeeStatus = 'full paid';
      } else if (totalPaidFromFees > 0) {
        newTrainingFeeStatus = 'partial';
      }
      
      console.log(`   New Training Fee Status: ${newTrainingFeeStatus}`);
      
      // Update registration record if there's a discrepancy
      if (student.paidAmount !== totalPaidFromFees || 
          student.dueAmount !== newDueAmount || 
          student.trainingFeeStatus !== newTrainingFeeStatus) {
        
        console.log(`\n🔧 UPDATING REGISTRATION RECORD...`);
        
        const oldValues = {
          paidAmount: student.paidAmount,
          dueAmount: student.dueAmount,
          trainingFeeStatus: student.trainingFeeStatus,
          tnxStatus: student.tnxStatus
        };
        
        // Update the registration
        student.paidAmount = totalPaidFromFees;
        student.dueAmount = newDueAmount;
        student.trainingFeeStatus = newTrainingFeeStatus;
        
        // Update transaction status based on payment
        if (totalPaidFromFees >= (student.finalFee || 0)) {
          student.tnxStatus = 'full paid';
        } else if (totalPaidFromFees > 0) {
          student.tnxStatus = 'paid';
        } else {
          student.tnxStatus = 'pending';
        }
        
        await student.save();
        
        console.log(`   ✅ Registration updated successfully!`);
        console.log(`   Old values:`, oldValues);
        console.log(`   New values:`, {
          paidAmount: student.paidAmount,
          dueAmount: student.dueAmount,
          trainingFeeStatus: student.trainingFeeStatus,
          tnxStatus: student.tnxStatus
        });
        
        // Also update fee records to ensure consistency
        for (const feeRecord of feeRecords) {
          feeRecord.paidAmount = totalPaidFromFees;
          feeRecord.dueAmount = newDueAmount;
          await feeRecord.save();
        }
        
        console.log(`   ✅ ${feeRecords.length} fee records updated for consistency`);
        
      } else {
        console.log(`\n✅ No discrepancy found - records are already correct!`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Fee record fix completed!');
    console.log(`${'='.repeat(60)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing fee records:', error.message);
    console.error(error);
    process.exit(1);
  }
};

fixStudentFeeRecords();