// scripts/checkDuplicateRegistrations.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const checkDuplicateRegistrations = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Checking for duplicate registrations...\n');

        // Check duplicates by email
        console.log('📧 Checking duplicates by EMAIL:');
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
                    students: { $push: { id: "$_id", name: "$studentName", mobile: "$mobile", status: "$status", createdAt: "$createdAt" } }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        if (emailDuplicates.length > 0) {
            console.log(`❌ Found ${emailDuplicates.length} duplicate email addresses:`);
            emailDuplicates.forEach((dup, index) => {
                console.log(`\n${index + 1}. Email: ${dup._id} (${dup.count} registrations)`);
                dup.students.forEach((student, i) => {
                    console.log(`   ${i + 1}. ${student.name} | ${student.mobile} | ${student.status} | ${new Date(student.createdAt).toLocaleDateString()}`);
                });
            });
        } else {
            console.log('✅ No duplicate emails found');
        }

        // Check duplicates by mobile
        console.log('\n📱 Checking duplicates by MOBILE:');
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
                    students: { $push: { id: "$_id", name: "$studentName", email: "$email", status: "$status", createdAt: "$createdAt" } }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        if (mobileDuplicates.length > 0) {
            console.log(`❌ Found ${mobileDuplicates.length} duplicate mobile numbers:`);
            mobileDuplicates.forEach((dup, index) => {
                console.log(`\n${index + 1}. Mobile: ${dup._id} (${dup.count} registrations)`);
                dup.students.forEach((student, i) => {
                    console.log(`   ${i + 1}. ${student.name} | ${student.email} | ${student.status} | ${new Date(student.createdAt).toLocaleDateString()}`);
                });
            });
        } else {
            console.log('✅ No duplicate mobile numbers found');
        }

        // Check duplicates by name + father name (potential same person)
        console.log('\n👤 Checking duplicates by NAME + FATHER NAME:');
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
                    students: { $push: { id: "$_id", name: "$studentName", fatherName: "$fatherName", email: "$email", mobile: "$mobile", status: "$status", createdAt: "$createdAt" } }
                }
            },
            {
                $match: { count: { $gt: 1 } }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        if (nameDuplicates.length > 0) {
            console.log(`❌ Found ${nameDuplicates.length} potential duplicate names:`);
            nameDuplicates.forEach((dup, index) => {
                console.log(`\n${index + 1}. Name: ${dup._id.studentName} | Father: ${dup._id.fatherName} (${dup.count} registrations)`);
                dup.students.forEach((student, i) => {
                    console.log(`   ${i + 1}. ${student.email} | ${student.mobile} | ${student.status} | ${new Date(student.createdAt).toLocaleDateString()}`);
                });
            });
        } else {
            console.log('✅ No duplicate names found');
        }

        // Summary
        console.log('\n📊 SUMMARY:');
        console.log(`📧 Email duplicates: ${emailDuplicates.length}`);
        console.log(`📱 Mobile duplicates: ${mobileDuplicates.length}`);
        console.log(`👤 Name duplicates: ${nameDuplicates.length}`);

        const totalRegistrations = await Registration.countDocuments();
        console.log(`\n📈 Total registrations in database: ${totalRegistrations}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error checking duplicates:', error);
        process.exit(1);
    }
};

checkDuplicateRegistrations();