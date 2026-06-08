// scripts/deleteDuplicateRegistrations.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import Fee from '../models/fee.js'; 
import Batch from '../models/batchs.js';
import dotenv from 'dotenv';
import XLSX from 'xlsx';

dotenv.config();

const duplicateUserIds = [
    'DCT-2026-0833',
    'DCT-2026-0148',
    'DCT-2026-0725',
    'DCT-2026-0833', // Duplicate in list
    'DCT-2026-0782',
    'DCT-2026-0711',
    'DCT-2026-0716',
    'DCT-2026-0724',
    'DCT-2026-0710',
    'DCT-2026-0832',
    'DCT-2026-0723',
    'DCT-2026-0825',
    'DCT-2026-0825', // Duplicate in list
    'DCT-2026-0592',
    'DCT-2026-1120',
    'DCT-2026-0082',
    'DCT-2026-0720',
    'DCT-2026-0718',
    'DCT-2026-0834',
    'DCT-2026-0826',
    'DCT-2026-0777',
    'DCT-2026-0828',
    'DCT-2026-0713',
    'DCT-2026-0831',
    'DCT-2026-0781',
    'DCT-2026-0068',
    'DCT-2026-0570',
    'DCT-2026-0860',
    'DCT-2026-0824',
    'DCT-2026-1406',
    'DCT-2026-0712',
    'DCT-2026-0827',
    'DCT-2026-0821',
    'DCT-2026-0715',
    'DCT-2026-0830',
    'DCT-2026-0779',
    'DCT-2026-0786'
];

const deleteDuplicateRegistrations = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Remove duplicates from the list
        const uniqueIds = [...new Set(duplicateUserIds)];
        console.log(`\n📋 Processing ${uniqueIds.length} unique duplicate registrations...\n`);

        // PHASE 1: VERIFICATION - Collect all data before deletion
        console.log('🔍 PHASE 1: VERIFICATION & DATA COLLECTION');
        console.log('='.repeat(60));

        const verificationData = [];
        const registrationsToDelete = [];
        const feesToDelete = [];
        let fullPaidCount = 0;
        let totalAmount = 0;

        for (const userId of uniqueIds) {
            try {
                // Find registration
                const registration = await Registration.findOne({ userid: userId }).lean();
                
                if (!registration) {
                    console.log(`❌ ${userId}: Registration not found`);
                    verificationData.push({
                        userId,
                        status: 'NOT FOUND',
                        student: null,
                        fees: [],
                        canDelete: false,
                        reason: 'Registration not found'
                    });
                    continue;
                }

                // Find related fees
                const relatedFees = await Fee.find({ registrationId: registration._id }).lean();
                
                // Check payment status
                const totalFee = registration.totalFee || 0;
                const paidAmount = registration.paidAmount || 0;
                const dueAmount = registration.dueAmount || 0;

                let canDelete = true;
                let reason = '';
                
                if (dueAmount === 0 && paidAmount > 0) {
                    fullPaidCount++;
                    canDelete = false;
                    reason = '🚨 FULL PAID - Cannot delete';
                    totalAmount += paidAmount;
                } else if (paidAmount > 0) {
                    canDelete = false; 
                    reason = `⚠️ PARTIAL PAID (₹${paidAmount}) - Review required`;
                    totalAmount += paidAmount;
                } else {
                    reason = '✅ Safe to delete - No payment';
                }

                console.log(`${canDelete ? '✅' : '🚨'} ${userId}: ${registration.studentName} | Paid: ₹${paidAmount} | Due: ₹${dueAmount} | ${reason}`);

                if (canDelete) {
                    registrationsToDelete.push(registration);
                    feesToDelete.push(...relatedFees);
                }

                verificationData.push({
                    userId,
                    status: canDelete ? 'CAN DELETE' : 'CANNOT DELETE',
                    student: registration,
                    fees: relatedFees,
                    canDelete,
                    reason,
                    paidAmount,
                    dueAmount,
                    totalFee
                });

            } catch (error) {
                console.log(`❌ ${userId}: Error - ${error.message}`);
                verificationData.push({
                    userId,
                    status: 'ERROR',
                    student: null,
                    fees: [],
                    canDelete: false,
                    reason: `Error: ${error.message}`
                });
            }
        }

        // VERIFICATION SUMMARY
        console.log('\n📊 VERIFICATION SUMMARY:');
        console.log('='.repeat(50));
        
        const safeToDelete = verificationData.filter(v => v.canDelete);
        const cannotDelete = verificationData.filter(v => !v.canDelete);
        
        console.log(`✅ Safe to delete: ${safeToDelete.length} registrations`);
        console.log(`🚨 Cannot delete: ${cannotDelete.length} registrations`);
        console.log(`💰 Total amount at risk: ₹${totalAmount}`);
        console.log(`📄 Related fees to delete: ${feesToDelete.length} records`);

        if (fullPaidCount > 0) {
            console.log(`\n🚨 WARNING: ${fullPaidCount} FULL PAID students found!`);
            console.log('These students will NOT be deleted:');
            cannotDelete.filter(v => v.reason.includes('FULL PAID')).forEach((v, i) => {
                console.log(`${i + 1}. ${v.userId} - ${v.student?.studentName} (₹${v.paidAmount} paid)`);
            });
        }

        // Create Excel verification report
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const excelData = verificationData.map(v => ({
            'User ID': v.userId,
            'Student Name': v.student?.studentName || 'N/A',
            'Mobile': v.student?.mobile || 'N/A',
            'Email': v.student?.email || 'N/A',
            'Status': v.student?.status || 'N/A',
            'Total Fee': v.totalFee || 0,
            'Paid Amount': v.paidAmount || 0,
            'Due Amount': v.dueAmount || 0,
            'Related Fees Count': v.fees?.length || 0,
            'Can Delete': v.canDelete ? 'YES' : 'NO',
            'Reason': v.reason,
            'Action Status': v.status
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        worksheet['!cols'] = [
            { wch: 18 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 10 },
            { wch: 35 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Verification_Report');
        
        const excelPath = `../exports/Duplicate_Deletion_Verification_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, excelPath);
        console.log(`\n📁 Verification report saved: ${excelPath}`);

        // Ask for confirmation before deletion
        console.log('\n🤔 CONFIRMATION REQUIRED:');
        console.log('='.repeat(40));
        console.log(`About to delete ${safeToDelete.length} registrations and ${feesToDelete.length} related fees.`);
        
        // Check if running in confirmation mode
        const confirmFlag = process.argv.includes('--confirm-delete');
        
        if (!confirmFlag) {
            console.log('\n⚠️  To proceed with deletion, run the script with --confirm-delete flag:');
            console.log('node scripts/deleteDuplicateRegistrations.js --confirm-delete');
            console.log('\n📋 Review the Excel report first!');
            process.exit(0);
        }

        // PHASE 2: DELETION
        console.log('\n🗑️  PHASE 2: DELETION PROCESS');
        console.log('='.repeat(50));

        let deletedRegistrations = 0;
        let deletedFees = 0;
        const deletionLog = [];

        // Delete fees first (to maintain referential integrity)
        console.log('\n🗑️  Deleting related fees...');
        for (const fee of feesToDelete) {
            try {
                await Fee.findByIdAndDelete(fee._id);
                deletedFees++;
                console.log(`   ✅ Deleted fee: ${fee._id}`);
                
                deletionLog.push({
                    type: 'Fee',
                    id: fee._id,
                    registrationId: fee.registrationId,
                    amount: fee.amount || 0,
                    status: 'Deleted'
                });
            } catch (error) {
                console.log(`   ❌ Failed to delete fee ${fee._id}: ${error.message}`);
                deletionLog.push({
                    type: 'Fee',
                    id: fee._id,
                    error: error.message,
                    status: 'Failed'
                });
            }
        }

        // Remove students from batches
        console.log('\n🗑️  Removing students from batches...');
        const registrationIds = registrationsToDelete.map(r => r._id);
        const batchUpdateResult = await Batch.updateMany(
            { students: { $in: registrationIds } },
            { $pull: { students: { $in: registrationIds } } }
        );
        console.log(`   ✅ Updated ${batchUpdateResult.modifiedCount} batches`);

        // Delete registrations
        console.log('\n🗑️  Deleting registrations...');
        for (const registration of registrationsToDelete) {
            try {
                await Registration.findByIdAndDelete(registration._id);
                deletedRegistrations++;
                console.log(`   ✅ Deleted registration: ${registration.userid} - ${registration.studentName}`);
                
                deletionLog.push({
                    type: 'Registration',
                    userId: registration.userid,
                    studentName: registration.studentName,
                    id: registration._id,
                    status: 'Deleted'
                });
            } catch (error) {
                console.log(`   ❌ Failed to delete registration ${registration.userid}: ${error.message}`);
                deletionLog.push({
                    type: 'Registration',
                    userId: registration.userid,
                    error: error.message,
                    status: 'Failed'
                });
            }
        }

        // FINAL SUMMARY
        console.log('\n🎉 DELETION COMPLETED!');
        console.log('='.repeat(40));
        console.log(`✅ Deleted registrations: ${deletedRegistrations}/${registrationsToDelete.length}`);
        console.log(`✅ Deleted fees: ${deletedFees}/${feesToDelete.length}`);
        console.log(`📋 Updated batches: ${batchUpdateResult.modifiedCount}`);
        console.log(`🚨 Preserved (paid students): ${cannotDelete.length}`);

        // Save deletion log
        const logPath = `../exports/Deletion_Log_${timestamp}.json`;
        const fs = await import('fs');
        fs.writeFileSync(logPath, JSON.stringify({
            timestamp: new Date().toISOString(),
            summary: {
                deletedRegistrations,
                deletedFees,
                preservedStudents: cannotDelete.length,
                totalRequested: uniqueIds.length
            },
            deletionLog,
            preservedStudents: cannotDelete.map(v => ({
                userId: v.userId,
                studentName: v.student?.studentName,
                reason: v.reason,
                paidAmount: v.paidAmount
            }))
        }, null, 2));
        
        console.log(`\n📁 Deletion log saved: ${logPath}`);
        console.log('\n✅ Duplicate cleanup completed successfully!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Critical Error:', error);
        process.exit(1);
    }
};

deleteDuplicateRegistrations();