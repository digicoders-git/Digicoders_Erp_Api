// scripts/checkRegistrationIdFormat.js
import mongoose from 'mongoose';
import Registration from '../models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();

const checkRegistrationIdFormat = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔍 Checking registration ID formats in database...\n');

        // Get sample registration IDs
        const samples = await Registration.find({
            registrationId: { $exists: true, $ne: null, $ne: "" }
        })
        .select('registrationId studentName createdAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

        console.log('📋 Sample Registration IDs found in database:');
        console.log('Format: registrationId | Student Name | Created Date\n');

        samples.forEach((student, i) => {
            const date = new Date(student.createdAt).toLocaleDateString();
            console.log(`${i + 1}. "${student.registrationId}" | ${student.studentName} | ${date}`);
        });

        // Check for specific patterns
        console.log('\n🔍 Checking for DCT-2026 pattern...');
        
        const dctPattern = await Registration.find({
            registrationId: { $regex: /DCT-2026/, $options: 'i' }
        })
        .select('registrationId studentName')
        .limit(10)
        .lean();

        if (dctPattern.length > 0) {
            console.log(`✅ Found ${dctPattern.length} records with DCT-2026 pattern:`);
            dctPattern.forEach((student, i) => {
                console.log(`${i + 1}. "${student.registrationId}" | ${student.studentName}`);
            });
        } else {
            console.log('❌ No records found with DCT-2026 pattern');
        }

        // Check for HTML entities
        console.log('\n🔍 Checking for HTML entities (&quot;)...');
        
        const htmlEntities = await Registration.find({
            registrationId: { $regex: /&quot;/, $options: 'i' }
        })
        .select('registrationId studentName')
        .limit(10)
        .lean();

        if (htmlEntities.length > 0) {
            console.log(`✅ Found ${htmlEntities.length} records with HTML entities:`);
            htmlEntities.forEach((student, i) => {
                console.log(`${i + 1}. ${student.registrationId} | ${student.studentName}`);
            });
        } else {
            console.log('❌ No records found with HTML entities');
        }

        // Count total registrations
        const totalCount = await Registration.countDocuments({
            registrationId: { $exists: true, $ne: null, $ne: "" }
        });
        
        console.log(`\n📊 Total registrations with IDs: ${totalCount}`);

        // Check registration ID field variations
        console.log('\n🔍 Checking field name variations...');
        
        const fieldCheck = await Registration.findOne({}).lean();
        if (fieldCheck) {
            const fields = Object.keys(fieldCheck).filter(key => 
                key.toLowerCase().includes('registration') || 
                key.toLowerCase().includes('id') ||
                key.toLowerCase().includes('dct')
            );
            console.log('📋 Fields containing "registration", "id", or "dct":');
            fields.forEach(field => console.log(`   - ${field}`));
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkRegistrationIdFormat();