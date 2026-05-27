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

const checkStudentFeeRecords = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const studentsToCheck = [
      { name: 'Akanksha Rai', userid: 'DCT-2026-0050' },
      { name: 'Mohini Pandey', userid: 'DCT-2026-0045' }
    ];
    
    for (const studentInfo of studentsToCheck) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`CHECKING RECORDS FOR: ${studentInfo.name} (${studentInfo.userid})`);
      console.log(`${'='.repeat(60)}`);
      
      // Find student registration record
      const student = await Registration.findOne({ userid: studentInfo.userid })
        .populate('technology', 'name price')
        .populate('training', 'name')
        .populate('branch', 'name')
        .populate('hrName', 'name');
      
      if (!student) {
        console.log(`❌ Student not found with ID: ${studentInfo.userid}`);
        continue;
      }
      
      console.log(`\n📋 REGISTRATION RECORD:`);
      console.log(`   Student Name: ${student.studentName}`);
      console.log(`   Mobile: ${student.mobile}`);
      console.log(`   Email: ${student.email}`);
      console.log(`   Technology: ${student.technology?.name || 'N/A'}`);
      console.log(`   Training: ${student.training?.name || 'N/A'}`);
      console.log(`   Branch: ${student.branch?.name || 'N/A'}`);
      console.log(`   HR: ${student.hrName?.name || 'N/A'}`);
      console.log(`   Registration Date: ${student.createdAt}`);
      
      console.log(`\n💰 FINANCIAL SUMMARY FROM REGISTRATION:`);
      console.log(`   Total Fee: ₹${student.totalFee || 0}`);
      console.log(`   Discount: ₹${student.discount || 0}`);
      console.log(`   Final Fee: ₹${student.finalFee || 0}`);
      console.log(`   Registration Amount: ₹${student.amount || 0}`);
      console.log(`   Paid Amount: ₹${student.paidAmount || 0}`);
      console.log(`   Due Amount: ₹${student.dueAmount || 0}`);
      console.log(`   Training Fee Status: ${student.trainingFeeStatus || 'N/A'}`);
      console.log(`   Transaction Status: ${student.tnxStatus || 'N/A'}`);
      console.log(`   Payment Method: ${student.paymentMethod || 'N/A'}`);
      console.log(`   Payment Type: ${student.paymentType || 'N/A'}`);
      console.log(`   Transaction ID: ${student.tnxId || 'N/A'}`);
      
      // Find all fee records for this student
      const feeRecords = await Fee.find({ registrationId: student._id })
        .populate('qrcode', 'name')
        .sort({ createdAt: 1 });
      
      console.log(`\n💳 FEE PAYMENT RECORDS (${feeRecords.length} records found):`);
      
      if (feeRecords.length === 0) {
        console.log(`   ⚠️  No fee payment records found!`);
      } else {
        let totalPaidFromFees = 0;
        
        feeRecords.forEach((fee, index) => {
          console.log(`\n   📄 Payment Record #${index + 1}:`);
          console.log(`      Fee ID: ${fee._id}`);
          console.log(`      Receipt No: ${fee.receiptNo || 'N/A'}`);
          console.log(`      Amount: ₹${fee.amount || 0}`);
          console.log(`      Total Fee: ₹${fee.totalFee || 0}`);
          console.log(`      Final Fee: ₹${fee.finalFee || 0}`);
          console.log(`      Paid Amount: ₹${fee.paidAmount || 0}`);
          console.log(`      Due Amount: ₹${fee.dueAmount || 0}`);
          console.log(`      Payment Type: ${fee.paymentType || 'N/A'}`);
          console.log(`      Payment Mode: ${fee.mode || 'N/A'}`);
          console.log(`      Transaction Status: ${fee.tnxStatus || 'N/A'}`);
          console.log(`      Status: ${fee.status || 'N/A'}`);
          console.log(`      Transaction ID: ${fee.tnxId || 'N/A'}`);
          console.log(`      QR Code: ${fee.qrcode?.name || 'N/A'}`);
          console.log(`      Payment Date: ${fee.paymentDate || fee.createdAt}`);
          console.log(`      Created At: ${fee.createdAt}`);
          console.log(`      Updated At: ${fee.updatedAt}`);
          
          // Add to total if payment is successful
          if (fee.tnxStatus === 'paid' || fee.status === 'accepted') {
            totalPaidFromFees += (fee.amount || 0);
          }
        });
        
        console.log(`\n📊 CALCULATION SUMMARY:`);
        console.log(`   Total from Fee Records (paid): ₹${totalPaidFromFees}`);
        console.log(`   Paid Amount in Registration: ₹${student.paidAmount || 0}`);
        console.log(`   Difference: ₹${(student.paidAmount || 0) - totalPaidFromFees}`);
        
        if ((student.paidAmount || 0) !== totalPaidFromFees) {
          console.log(`   ⚠️  DISCREPANCY DETECTED!`);
          console.log(`   Registration shows: ₹${student.paidAmount || 0}`);
          console.log(`   Fee records total: ₹${totalPaidFromFees}`);
        } else {
          console.log(`   ✅ Amounts match perfectly!`);
        }
      }
      
      // Check for any duplicate or orphaned records
      console.log(`\n🔍 ADDITIONAL CHECKS:`);
      
      // Check if there are multiple registrations with same userid
      const duplicateRegs = await Registration.find({ userid: studentInfo.userid });
      if (duplicateRegs.length > 1) {
        console.log(`   ⚠️  Multiple registrations found with same userid!`);
        duplicateRegs.forEach((reg, index) => {
          console.log(`      Registration #${index + 1}: ${reg._id} (${reg.studentName})`);
        });
      }
      
      // Check for fee records without proper registration link
      const orphanedFees = await Fee.find({
        $or: [
          { registrationId: { $exists: false } },
          { registrationId: null }
        ]
      });
      
      if (orphanedFees.length > 0) {
        console.log(`   ⚠️  Found ${orphanedFees.length} orphaned fee records (no registration link)`);
      }
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ Fee record check completed!');
    console.log(`${'='.repeat(60)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking fee records:', error.message);
    console.error(error);
    process.exit(1);
  }
};

checkStudentFeeRecords();