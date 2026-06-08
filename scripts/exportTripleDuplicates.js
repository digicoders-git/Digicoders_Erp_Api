// scripts/exportTripleDuplicates.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const exportTripleDuplicates = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Finding triple duplicates (Mobile + Name + Email)...\n');

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
            }
        ]);

        // Step 2: Find email duplicates
        const emailDuplicates = await Registration.aggregate([
            {
                $match: {
                    email: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$email",
                    count: { $sum: 1 },
                    students: { $push: "$$ROOT" }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        // Step 3: Find name duplicates (student name + father name)
        const nameDuplicates = await Registration.aggregate([
            {
                $match: {
                    studentName: { $exists: true, $ne: null, $ne: "" },
                    fatherName: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: {
                        studentName: { $toLower: "$studentName" },
                        fatherName: { $toLower: "$fatherName" }
                    },
                    count: { $sum: 1 },
                    students: { $push: "$$ROOT" }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            }
        ]);

        // Create sets for faster lookup
        const duplicateMobiles = new Set(mobileDuplicates.map(d => d._id));
        const duplicateEmails = new Set(emailDuplicates.map(d => d._id));
        const duplicateNames = new Set(nameDuplicates.map(d => 
            `${d._id.studentName}-${d._id.fatherName}`
        ));

        console.log(`📱 Mobile duplicates found: ${duplicateMobiles.size}`);
        console.log(`📧 Email duplicates found: ${duplicateEmails.size}`);
        console.log(`👤 Name duplicates found: ${duplicateNames.size}`);

        // Step 4: Find students who have ALL THREE types of duplicates
        const tripleDuplicates = [];
        
        // Get all registrations
        const allRegistrations = await Registration.find({}).lean();
        
        for (const student of allRegistrations) {
            const hasMobileDuplicate = duplicateMobiles.has(student.mobile);
            const hasEmailDuplicate = duplicateEmails.has(student.email);
            const hasNameDuplicate = duplicateNames.has(
                `${student.studentName?.toLowerCase()}-${student.fatherName?.toLowerCase()}`
            );

            if (hasMobileDuplicate && hasEmailDuplicate && hasNameDuplicate) {
                tripleDuplicates.push({
                    'Student ID': student._id.toString(),
                    'Student Name': student.studentName || '',
                    'Father Name': student.fatherName || '',
                    'Mobile': student.mobile || '',
                    'Email': student.email || '',
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
            }
        }

        console.log(`\n🎯 Triple duplicates found: ${tripleDuplicates.length}`);

        if (tripleDuplicates.length === 0) {
            console.log('✅ No students found with ALL THREE types of duplicates!');
            process.exit(0);
        }

        // Step 5: Create Excel file
        const workbook = XLSX.utils.book_new();
        
        // Main sheet with triple duplicates
        const worksheet = XLSX.utils.json_to_sheet(tripleDuplicates);
        
        // Auto-fit columns
        const colWidths = [
            { wch: 25 }, // Student ID
            { wch: 25 }, // Student Name
            { wch: 25 }, // Father Name
            { wch: 15 }, // Mobile
            { wch: 30 }, // Email
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
        worksheet['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(workbook, worksheet, 'Triple_Duplicates');

        // Create summary sheet
        const summaryData = [
            { 'Duplicate Type': 'Mobile Numbers', 'Count': duplicateMobiles.size },
            { 'Duplicate Type': 'Email Addresses', 'Count': duplicateEmails.size },
            { 'Duplicate Type': 'Names (Student + Father)', 'Count': duplicateNames.size },
            { 'Duplicate Type': 'ALL THREE DUPLICATES', 'Count': tripleDuplicates.length },
            { 'Duplicate Type': '', 'Count': '' },
            { 'Duplicate Type': 'Total Registrations', 'Count': allRegistrations.length }
        ];
        
        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        summarySheet['!cols'] = [{ wch: 30 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `../exports/Triple_Duplicates_${timestamp}.xlsx`;

        // Write file
        XLSX.writeFile(workbook, filename);

        console.log('\n✅ Excel file created successfully!');
        console.log(`📁 Location: ${filename}`);
        console.log(`📊 Records exported: ${tripleDuplicates.length}`);
        
        // Show sample data
        if (tripleDuplicates.length > 0) {
            console.log('\n📋 Sample records:');
            tripleDuplicates.slice(0, 3).forEach((student, i) => {
                console.log(`${i + 1}. ${student['Student Name']} | ${student['Mobile']} | ${student['Email']}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

exportTripleDuplicates();