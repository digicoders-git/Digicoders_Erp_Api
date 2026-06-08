// scripts/checkUserIdPaymentStatus.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const userIds = [
    'DCT-2026-0833',
    'DCT-2026-0148',
    'DCT-2026-0725',
    'DCT-2026-0782',
    'DCT-2026-0711',
    'DCT-2026-0716',
    'DCT-2026-0724',
    'DCT-2026-0710',
    'DCT-2026-0832',
    'DCT-2026-0723',
    'DCT-2026-0825',
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

const checkUserIdPaymentStatus = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Checking userid field for payment status...\n');

        // First check what userid formats exist
        console.log('📋 Sample userid formats in database:');
        const sampleUserIds = await Registration.find({
            userid: { $exists: true, $ne: null, $ne: "" }
        })
        .select('userid studentName')
        .limit(10)
        .lean();

        if (sampleUserIds.length > 0) {
            sampleUserIds.forEach((student, i) => {
                console.log(`${i + 1}. ${student.userid} | ${student.studentName}`);
            });
        } else {
            console.log('❌ No userid field found');
        }

        console.log('\n📊 Checking each provided ID...\n');

        const uniqueIds = [...new Set(userIds)];
        const results = [];
        let fullPaidCount = 0;
        let notFoundCount = 0;
        let partialPaidCount = 0;
        let noDueCount = 0;
        let notPaidCount = 0;

        for (const userId of uniqueIds) {
            let student = null;
            let searchedFormat = '';
            
            try {
                // Try different formats for userid field
                const formats = [
                    userId,                                    // DCT-2026-0833
                    `"${userId}"`,                            // "DCT-2026-0833"
                    `&quot;${userId}&quot;`,                 // &quot;DCT-2026-0833&quot;
                    userId.replace(/-/g, ''),                 // DCT20260833
                    `"${userId.replace(/-/g, '')}"`,          // "DCT20260833"
                ];

                for (const format of formats) {
                    student = await Registration.findOne({ userid: format })
                        .select('userid studentName mobile email dueAmount paidAmount totalFee status')
                        .lean();
                        
                    if (student) {
                        searchedFormat = format;
                        break;
                    }
                }

                if (!student) {
                    console.log(`❌ ${userId}: NOT FOUND (tried multiple formats)`);
                    results.push({
                        'User ID': userId,
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
                    paymentStatus = '🚨 FULL PAID 🚨';
                    statusIcon = '🚨';
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

                console.log(`${statusIcon} ${userId}: ${student.studentName} | Total: ₹${totalFee} | Paid: ₹${paidAmount} | Due: ₹${dueAmount} | ${paymentStatus}`);

                results.push({
                    'User ID': userId,
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
                console.log(`❌ ${userId}: ERROR - ${error.message}`);
            }
        }

        // Summary
        console.log('\n📊 FINAL SUMMARY:');
        console.log('='.repeat(50));
        console.log(`🚨 FULL PAID: ${fullPaidCount}`);
        console.log(`🟡 PARTIAL PAID: ${partialPaidCount}`);
        console.log(`🔴 NOT PAID: ${notPaidCount}`);
        console.log(`⚪ NO FEE: ${noDueCount}`);
        console.log(`❌ NOT FOUND: ${notFoundCount}`);
        console.log(`📋 TOTAL CHECKED: ${uniqueIds.length}`);

        // Alert for full paid students
        const fullPaidStudents = results.filter(r => r['Payment Status'].includes('FULL PAID'));
        if (fullPaidStudents.length > 0) {
            console.log('\n🚨🚨🚨 ALERT: FULL PAID STUDENTS FOUND! 🚨🚨🚨');
            console.log('='.repeat(60));
            fullPaidStudents.forEach((student, i) => {
                console.log(`${i + 1}. ${student['User ID']} - ${student['Student Name']}`);
                console.log(`   💰 Paid Amount: ₹${student['Paid Amount']}`);
                console.log(`   📱 Mobile: ${student['Mobile']}`);
                console.log(`   📧 Email: ${student['Email']}`);
                console.log(`   📝 Status: ${student['Status']}`);
                console.log('   ' + '-'.repeat(50));
            });
        } else {
            console.log('\n✅ NO FULL PAID STUDENTS FOUND - All clear for deletion!');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkUserIdPaymentStatus();