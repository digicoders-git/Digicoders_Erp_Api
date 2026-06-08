// scripts/checkFullPaidStatus.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

// Original IDs with possible HTML entities
const registrationIds = [
    'DCT-2026-0833',
    'DCT-2026-0148', 
    'DCT-2026-0725',
    'DCT-2026-0833', // Duplicate
    'DCT-2026-0782',
    'DCT-2026-0711',
    'DCT-2026-0716',
    'DCT-2026-0724',
    'DCT-2026-0710',
    'DCT-2026-0832',
    'DCT-2026-0723',
    'DCT-2026-0825',
    'DCT-2026-0825', // Duplicate
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

const checkFullPaidStatus = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Checking payment status for provided registration IDs...\n');

        // Remove duplicates from the list
        const uniqueIds = [...new Set(registrationIds)];
        console.log(`📋 Total IDs provided: ${registrationIds.length}`);
        console.log(`📋 Unique IDs: ${uniqueIds.length}`);

        const results = [];
        let fullPaidCount = 0;
        let notFoundCount = 0;
        let partialPaidCount = 0;
        let noDueCount = 0;
        let notPaidCount = 0;

        console.log('\n📊 Checking each registration (trying multiple formats):\n');

        for (const regId of uniqueIds) {
            let student = null;
            let searchedFormat = '';
            
            try {
                // Try different formats
                const formats = [
                    regId,                                    // DCT-2026-0833
                    `&quot;${regId}&quot;`,                      // "DCT-2026-0833"
                    `"${regId}"`,                            // "DCT-2026-0833"
                    regId.replace(/-/g, ''),                 // DCT20260833
                    `&quot;${regId.replace(/-/g, '')}&quot;`      // "DCT20260833"
                ];

                for (const format of formats) {
                    student = await Registration.findOne({ registrationId: format })
                        .select('registrationId studentName mobile email dueAmount paidAmount totalFee status')
                        .lean();
                        
                    if (student) {
                        searchedFormat = format;
                        break;
                    }
                }

                if (!student) {
                    console.log(`❌ ${regId}: NOT FOUND (tried multiple formats)`);
                    results.push({
                        'Registration ID': regId,
                        'Student Name': 'NOT FOUND',
                        'Mobile': 'N/A',
                        'Email': 'N/A',
                        'Total Fee': 'N/A',
                        'Paid Amount': 'N/A',
                        'Due Amount': 'N/A',
                        'Status': 'NOT FOUND',
                        'Payment Status': 'NOT FOUND',
                        'Found Format': 'N/A'
                    });
                    notFoundCount++;
                    continue;
                }

                const totalFee = student.totalFee || 0;
                const paidAmount = student.paidAmount || 0;
                const dueAmount = student.dueAmount || 0;

                let paymentStatus = '';
                let statusIcon = '';

                if (dueAmount === 0 && paidAmount > 0) {
                    paymentStatus = 'FULL PAID';
                    statusIcon = '✅';
                    fullPaidCount++;
                } else if (dueAmount === 0 && paidAmount === 0 && totalFee === 0) {
                    paymentStatus = 'NO FEE';
                    statusIcon = '⚪';
                    noDueCount++;
                } else if (paidAmount > 0 && dueAmount > 0) {
                    paymentStatus = 'PARTIAL PAID';
                    statusIcon = '🟡';
                    partialPaidCount++;
                } else {
                    paymentStatus = 'NOT PAID';
                    statusIcon = '🔴';
                    notPaidCount++;
                }

                console.log(`${statusIcon} ${regId}: ${student.studentName} | Total: ₹${totalFee} | Paid: ₹${paidAmount} | Due: ₹${dueAmount} | ${paymentStatus} | Format: ${searchedFormat}`);

                results.push({
                    'Registration ID': regId,
                    'Student Name': student.studentName || '',
                    'Mobile': student.mobile || '',
                    'Email': student.email || '',
                    'Total Fee': totalFee,
                    'Paid Amount': paidAmount,
                    'Due Amount': dueAmount,
                    'Status': student.status || '',
                    'Payment Status': paymentStatus,
                    'Found Format': searchedFormat
                });

            } catch (error) {
                console.log(`❌ ${regId}: ERROR - ${error.message}`);
                results.push({
                    'Registration ID': regId,
                    'Student Name': 'ERROR',
                    'Mobile': 'N/A',
                    'Email': 'N/A', 
                    'Total Fee': 'N/A',
                    'Paid Amount': 'N/A',
                    'Due Amount': 'N/A',
                    'Status': 'ERROR',
                    'Payment Status': 'ERROR',
                    'Found Format': 'ERROR'
                });
            }
        }

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`✅ Full Paid: ${fullPaidCount}`);
        console.log(`🟡 Partial Paid: ${partialPaidCount}`);
        console.log(`🔴 Not Paid: ${notPaidCount}`);
        console.log(`⚪ No Fee/Zero Due: ${noDueCount}`);
        console.log(`❌ Not Found: ${notFoundCount}`);
        console.log(`📋 Total Checked: ${uniqueIds.length}`);

        // Show full paid students if any
        const fullPaidStudents = results.filter(r => r['Payment Status'] === 'FULL PAID');
        if (fullPaidStudents.length > 0) {
            console.log('\n🚨 FULL PAID STUDENTS FOUND:');
            fullPaidStudents.forEach((student, i) => {
                console.log(`${i + 1}. ${student['Registration ID']} - ${student['Student Name']} (Paid: ₹${student['Paid Amount']})`);
            });
        } else {
            console.log('\n✅ NO FULL PAID STUDENTS FOUND - All clear!');
        }

        // Show found students formats
        const foundStudents = results.filter(r => r['Payment Status'] !== 'NOT FOUND' && r['Payment Status'] !== 'ERROR');
        if (foundStudents.length > 0) {
            console.log('\n📋 Found Students:');
            foundStudents.forEach((student, i) => {
                console.log(`${i + 1}. ${student['Registration ID']} → Found as: ${student['Found Format']}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkFullPaidStatus();