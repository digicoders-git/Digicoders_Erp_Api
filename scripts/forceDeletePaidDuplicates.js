// scripts/forceDeletePaidDuplicates.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import Fee from '../models/fee.js';
import Batch from '../models/batchs.js';
import dotenv from 'dotenv';

dotenv.config();

// The 34 paid students that were protected
const paidDuplicateIds = [
    'DCT-2026-0833', // Devendra - ₹500
    'DCT-2026-0148', // Vikas Prajapati - ₹1000
    'DCT-2026-0725', // Ayan siddiqui - ₹500
    'DCT-2026-0782', // Sandeep Pal - ₹500
    'DCT-2026-0711', // Alka Gupta - ₹500
    'DCT-2026-0716', // Manzar Ali - ₹500
    'DCT-2026-0724', // Vanshika Shrivastav - ₹500
    'DCT-2026-0710', // Pallavi sharma - ₹500
    'DCT-2026-0832', // Antu yadav - ₹500
    'DCT-2026-0723', // Priyal Yadav - ₹500
    'DCT-2026-0825', // Vineet Singh - ₹500
    'DCT-2026-0592', // Divya kumari - ₹500
    'DCT-2026-0082', // Prateek Singh - ₹500
    'DCT-2026-0720', // Rajnish Kumar Yadav - ₹500
    'DCT-2026-0718', // Akash Kumar Verma - ₹500
    'DCT-2026-0834', // Kamya Tripathi - ₹500
    'DCT-2026-0826', // Abhay kumar - ₹500
    'DCT-2026-0777', // Vikash Kumar - ₹500
    'DCT-2026-0828', // Sujal - ₹500
    'DCT-2026-0713', // Himanshu kasaudhan - ₹500
    'DCT-2026-0831', // Kashish - ₹500
    'DCT-2026-0781', // Ankit Mishra - ₹500
    'DCT-2026-0068', // Ranu Verma - ₹500
    'DCT-2026-0570', // Sonam Singh - ₹500
    'DCT-2026-0860', // Suraj Gupta - ₹1000
    'DCT-2026-0824', // Shubham kumar - ₹500
    'DCT-2026-1406', // Ruchi singh - ₹2000 (FULL PAID)
    'DCT-2026-0712', // Shreya Srivastava - ₹500
    'DCT-2026-0827', // Indra kumar - ₹500
    'DCT-2026-0821', // Anam Fatima - ₹500
    'DCT-2026-0715', // Ravi Prakash Verma - ₹500
    'DCT-2026-0830', // Umesh kushwah - ₹500
    'DCT-2026-0779', // Akash Kumar Verma - ₹500
    'DCT-2026-0786'  // Arun yadav - ₹500
];

const forceDeletePaidDuplicates = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🚨 FORCE DELETION OF PAID DUPLICATES');
        console.log('='.repeat(60));
        console.log('⚠️  WARNING: This will delete students with payments!');
        console.log(`📋 Processing ${paidDuplicateIds.length} paid duplicate students...`);

        let totalAmountLoss = 0;
        let deletedRegistrations = 0;
        let deletedFees = 0;
        const deletionResults = [];

        console.log('\n🔍 COLLECTING DATA FOR FORCE DELETION:');
        console.log('-'.repeat(50));

        for (const userId of paidDuplicateIds) {
            try {
                // Find registration
                const registration = await Registration.findOne({ userid: userId }).lean();
                
                if (!registration) {
                    console.log(`❌ ${userId}: Not found - may have been deleted already`);
                    deletionResults.push({
                        userId,
                        status: 'NOT FOUND',
                        error: 'Registration not found'
                    });
                    continue;
                }

                // Find related fees
                const relatedFees = await Fee.find({ registrationId: registration._id }).lean();
                
                const paidAmount = registration.paidAmount || 0;
                totalAmountLoss += paidAmount;

                console.log(`💰 ${userId}: ${registration.studentName} | Paid: ₹${paidAmount} | Fees: ${relatedFees.length} records`);

                deletionResults.push({
                    userId,
                    studentName: registration.studentName,
                    paidAmount,
                    relatedFees: relatedFees.length,
                    registrationId: registration._id,
                    feeIds: relatedFees.map(f => f._id),
                    status: 'READY_FOR_DELETION'
                });

            } catch (error) {
                console.log(`❌ ${userId}: Error - ${error.message}`);
                deletionResults.push({
                    userId,
                    status: 'ERROR',
                    error: error.message
                });
            }
        }

        // Summary before deletion
        const readyForDeletion = deletionResults.filter(r => r.status === 'READY_FOR_DELETION');
        const totalFeesToDelete = readyForDeletion.reduce((sum, r) => sum + r.relatedFees, 0);

        console.log('\n📊 PRE-DELETION SUMMARY:');
        console.log('='.repeat(40));
        console.log(`🎯 Students to delete: ${readyForDeletion.length}/${paidDuplicateIds.length}`);
        console.log(`💰 Total amount loss: ₹${totalAmountLoss}`);
        console.log(`📄 Total fees to delete: ${totalFeesToDelete}`);
        
        // Special warning for full paid student
        const fullPaidStudent = readyForDeletion.find(r => r.userId === 'DCT-2026-1406');
        if (fullPaidStudent) {
            console.log(`🚨 INCLUDES FULL PAID: ${fullPaidStudent.studentName} (₹${fullPaidStudent.paidAmount})`);
        }

        // Check for confirmation
        const forceFlag = process.argv.includes('--force-delete-paid');
        
        if (!forceFlag) {
            console.log('\n⚠️  CONFIRMATION REQUIRED FOR PAID DELETION:');
            console.log('To proceed with deleting PAID students, run:');
            console.log('node scripts/forceDeletePaidDuplicates.js --force-delete-paid');
            console.log('\n🚨 This will cause ₹' + totalAmountLoss + ' financial loss!');
            process.exit(0);
        }

        // FORCE DELETION PROCESS
        console.log('\n🗑️  FORCE DELETION IN PROGRESS...');
        console.log('='.repeat(50));

        // Delete fees first
        console.log('\n1️⃣ Deleting related fees...');
        for (const result of readyForDeletion) {
            for (const feeId of result.feeIds) {
                try {
                    await Fee.findByIdAndDelete(feeId);
                    deletedFees++;
                    console.log(`   ✅ Deleted fee: ${feeId}`);
                } catch (error) {
                    console.log(`   ❌ Failed to delete fee ${feeId}: ${error.message}`);
                }
            }
        }

        // Remove from batches
        console.log('\n2️⃣ Removing students from batches...');
        const registrationIds = readyForDeletion.map(r => r.registrationId);
        const batchUpdateResult = await Batch.updateMany(
            { students: { $in: registrationIds } },
            { $pull: { students: { $in: registrationIds } } }
        );
        console.log(`   ✅ Updated ${batchUpdateResult.modifiedCount} batches`);

        // Delete registrations
        console.log('\n3️⃣ Deleting registrations...');
        for (const result of readyForDeletion) {
            try {
                await Registration.findByIdAndDelete(result.registrationId);
                deletedRegistrations++;
                console.log(`   ✅ Deleted: ${result.userId} - ${result.studentName} (₹${result.paidAmount} lost)`);
            } catch (error) {
                console.log(`   ❌ Failed to delete ${result.userId}: ${error.message}`);
            }
        }

        // FINAL RESULTS
        console.log('\n🎉 FORCE DELETION COMPLETED!');
        console.log('='.repeat(50));
        console.log(`✅ Deleted registrations: ${deletedRegistrations}/${readyForDeletion.length}`);
        console.log(`✅ Deleted fees: ${deletedFees}/${totalFeesToDelete}`);
        console.log(`📋 Updated batches: ${batchUpdateResult.modifiedCount}`);
        console.log(`💸 FINANCIAL LOSS: ₹${totalAmountLoss}`);
        
        if (fullPaidStudent && deletedRegistrations > 0) {
            console.log(`🚨 FULL PAID STUDENT DELETED: ${fullPaidStudent.studentName} (₹${fullPaidStudent.paidAmount})`);
        }

        // Save deletion log
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const logPath = `../exports/Force_Deletion_Log_${timestamp}.json`;
        const fs = await import('fs');
        
        fs.writeFileSync(logPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            action: 'FORCE_DELETE_PAID_DUPLICATES',
            summary: {
                requestedDeletions: paidDuplicateIds.length,
                actualDeletions: deletedRegistrations,
                deletedFees,
                updatedBatches: batchUpdateResult.modifiedCount,
                totalFinancialLoss: totalAmountLoss
            },
            deletionResults,
            warning: 'PAID STUDENTS DELETED - FINANCIAL LOSS OCCURRED'
        }, null, 2));

        console.log(`\n📁 Force deletion log saved: ${logPath}`);
        console.log('\n⚠️  All paid duplicate students have been deleted!');
        console.log('💸 Financial impact: ₹' + totalAmountLoss + ' lost in payments');

        process.exit(0);
    } catch (error) {
        console.error('❌ Critical Error:', error);
        process.exit(1);
    }
};

forceDeletePaidDuplicates();