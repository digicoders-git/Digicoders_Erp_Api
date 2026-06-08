// scripts/exportMobileDuplicatesWithEmails.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const exportMobileDuplicatesWithEmails = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Finding mobile duplicates and their email status...\n');

        // Step 1: Find all mobile duplicates
        const mobileDuplicates = await Registration.aggregate([
            {
                $match: {
                    mobile: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$mobile",
                    count: { $sum: 1 },
                    students: { $push: "$$ROOT" }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        console.log(`📱 Mobile duplicates found: ${mobileDuplicates.length}`);

        // Step 2: Find all email duplicates for reference
        const emailDuplicates = await Registration.aggregate([
            {
                $match: {
                    email: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$email",
                    count: { $sum: 1 }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        const duplicateEmails = new Set(emailDuplicates.map(d => d._id));
        console.log(`📧 Email duplicates found for reference: ${duplicateEmails.size}`);

        // Step 3: Process mobile duplicates and check email status
        const exportData = [];

        mobileDuplicates.forEach((mobileGroup, groupIndex) => {
            const mobile = mobileGroup._id;
            const students = mobileGroup.students;

            console.log(`\n📱 Processing mobile ${mobile} (${students.length} students):`);

            students.forEach((student, studentIndex) => {
                const hasEmailDuplicate = student.email && duplicateEmails.has(student.email);
                
                console.log(`   ${studentIndex + 1}. ${student.studentName} | ${student.email || 'NO EMAIL'} | Email Duplicate: ${hasEmailDuplicate ? 'YES' : 'NO'}`);

                exportData.push({
                    'Group #': groupIndex + 1,
                    'Duplicate Mobile': mobile,
                    'Total Students with Same Mobile': students.length,
                    'Student #': studentIndex + 1,
                    'Student ID': student._id.toString(),
                    'Student Name': student.studentName || '',
                    'Father Name': student.fatherName || '',
                    'Email': student.email || 'NO EMAIL',
                    'Email is Also Duplicate': hasEmailDuplicate ? 'YES' : 'NO',
                    'Status': student.status || '',
                    'Branch': student.branch || '',
                    'Technology': student.technology || '',
                    'HR Name': student.hrName || '',
                    'College': student.collegeName || '',
                    'Registration Date': student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '',
                    'Due Amount': student.dueAmount || 0,
                    'Address': student.address || '',
                    'City': student.city || '',
                    'District': student.district || '',
                    'State': student.state || ''
                });
            });
        });

        console.log(`\n📊 Total records to export: ${exportData.length}`);

        // Step 4: Create statistics
        const mobileAndEmailDuplicates = exportData.filter(record => record['Email is Also Duplicate'] === 'YES');
        const mobileOnlyDuplicates = exportData.filter(record => record['Email is Also Duplicate'] === 'NO');
        const noEmailProvided = exportData.filter(record => record['Email'] === 'NO EMAIL');

        console.log(`📊 Statistics:`);
        console.log(`   📱➕📧 Mobile + Email both duplicate: ${mobileAndEmailDuplicates.length}`);
        console.log(`   📱 Mobile duplicate only: ${mobileOnlyDuplicates.length}`);
        console.log(`   ❌ No email provided: ${noEmailProvided.length}`);

        // Step 5: Create Excel workbook
        const workbook = XLSX.utils.book_new();

        // Main sheet - All mobile duplicates with email status
        const mainSheet = XLSX.utils.json_to_sheet(exportData);
        const colWidths = [
            { wch: 8 },  // Group #
            { wch: 15 }, // Duplicate Mobile
            { wch: 12 }, // Total Students
            { wch: 8 },  // Student #
            { wch: 25 }, // Student ID
            { wch: 25 }, // Student Name
            { wch: 25 }, // Father Name
            { wch: 30 }, // Email
            { wch: 18 }, // Email is Also Duplicate
            { wch: 12 }, // Status
            { wch: 20 }, // Branch
            { wch: 20 }, // Technology
            { wch: 20 }, // HR Name
            { wch: 25 }, // College
            { wch: 15 }, // Registration Date
            { wch: 12 }, // Due Amount
            { wch: 30 }, // Address
            { wch: 15 }, // City
            { wch: 15 }, // District
            { wch: 15 }  // State
        ];
        mainSheet['!cols'] = colWidths;
        XLSX.utils.book_append_sheet(workbook, mainSheet, 'Mobile_Duplicates_All');

        // Sheet 2 - Only students with both mobile and email duplicates
        if (mobileAndEmailDuplicates.length > 0) {
            const bothDuplicatesSheet = XLSX.utils.json_to_sheet(mobileAndEmailDuplicates);
            bothDuplicatesSheet['!cols'] = colWidths;
            XLSX.utils.book_append_sheet(workbook, bothDuplicatesSheet, 'Mobile_Email_Both_Duplicate');
        }

        // Sheet 3 - Summary statistics
        const summaryData = [
            { 'Category': 'Total Mobile Duplicate Groups', 'Count': mobileDuplicates.length },
            { 'Category': 'Total Students with Mobile Duplicates', 'Count': exportData.length },
            { 'Category': '', 'Count': '' },
            { 'Category': 'Mobile + Email Both Duplicate', 'Count': mobileAndEmailDuplicates.length },
            { 'Category': 'Mobile Duplicate Only', 'Count': mobileOnlyDuplicates.length },
            { 'Category': 'No Email Provided', 'Count': noEmailProvided.length },
            { 'Category': '', 'Count': '' },
            { 'Category': 'Total Email Duplicates in System', 'Count': duplicateEmails.size }
        ];

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        summarySheet['!cols'] = [{ wch: 35 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

        // Step 6: Export to file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `../exports/Mobile_Duplicates_With_Emails_${timestamp}.xlsx`;

        XLSX.writeFile(workbook, filename);

        console.log('\n✅ Excel file created successfully!');
        console.log(`📁 Location: ${filename}`);
        console.log(`📊 Total records: ${exportData.length}`);
        console.log(`📊 Sheets created: ${workbook.SheetNames.length}`);

        // Show top mobile duplicate groups
        console.log('\n📋 Top mobile duplicate groups:');
        mobileDuplicates.slice(0, 5).forEach((group, i) => {
            const bothEmailDups = group.students.filter(s => s.email && duplicateEmails.has(s.email)).length;
            console.log(`${i + 1}. Mobile: ${group._id} - ${group.students.length} students (${bothEmailDups} with email duplicates)`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

exportMobileDuplicatesWithEmails();