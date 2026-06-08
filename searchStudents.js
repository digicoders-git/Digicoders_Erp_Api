import mongoose from 'mongoose';
import Registration from './models/regsitration.js';
import dotenv from 'dotenv';

dotenv.config();
mongoose.connect(process.env.MONGODB_URI);

const mobileNumbers = [
    '7275241683', '6388302696', '7052810036', '9838203971', '9721303772',
    '9389692215', '9369572641', '9368131374', '9336712730', '9235790193',
    '9234716100', '9151346503', '9580567369', '9151346503', '8182025019',
    '7351238134', '7318509936', '8429114622', '8938052968', '8881037319',
    '8858093605', '7786851828', '7080384915', '7275241683', '7275834190',
    '7457889516', '7351238134', '7668428795', '7991833566', '8009837964',
    '8182025019', '8400506799', '8756444673', '8869829442', '8924037664'
];

async function searchStudents() {
    try {
        console.log('🔍 Searching students with different mobile formats...\n');
        
        const results = {
            found: [],
            notFound: []
        };

        for (const mobile of mobileNumbers) {
            // Try different formats
            const variations = [
                mobile,                    // 1234567890
                `+91 ${mobile}`,          // +91 1234567890
                `+91${mobile}`,           // +911234567890
                `91${mobile}`,            // 911234567890
                `+91 ${mobile.slice(0,5)} ${mobile.slice(5)}` // +91 12345 67890
            ];

            let student = null;
            let foundFormat = '';

            for (const variation of variations) {
                student = await Registration.findOne({ mobile: variation })
                    .select('userid studentName mobile training technology hrName branch status');
                
                if (student) {
                    foundFormat = variation;
                    break;
                }
            }
            
            if (student) {
                results.found.push({
                    searchMobile: mobile,
                    foundFormat: foundFormat,
                    userid: student.userid,
                    name: student.studentName,
                    training: student.training || 'N/A',
                    technology: student.technology || 'N/A',
                    hrName: student.hrName || 'N/A',
                    branch: student.branch || 'N/A',
                    status: student.status
                });
            } else {
                results.notFound.push(mobile);
            }
        }

        // Display results
        console.log(`📊 SEARCH RESULTS:`);
        console.log(`Total numbers searched: ${mobileNumbers.length}`);
        console.log(`Students found: ${results.found.length}`);
        console.log(`Students not found: ${results.notFound.length}\n`);

        // Show found students
        if (results.found.length > 0) {
            console.log('✅ FOUND STUDENTS:');
            
            results.found.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.name}`);
                console.log(`   Search: ${student.searchMobile} → Found: ${student.foundFormat}`);
                console.log(`   Training ID: ${student.training}`);
                console.log(`   Technology ID: ${student.technology}`);
                console.log(`   HR ID: ${student.hrName} | Branch ID: ${student.branch}`);
                console.log(`   Status: ${student.status}\n`);
            });
        }

        // Show not found (only first 10 to avoid spam)
        if (results.notFound.length > 0) {
            console.log(`❌ NOT FOUND (${results.notFound.length} numbers):`);
            const showLimit = Math.min(results.notFound.length, 10);
            for (let i = 0; i < showLimit; i++) {
                console.log(`${i + 1}. ${results.notFound[i]}`);
            }
            if (results.notFound.length > 10) {
                console.log(`... and ${results.notFound.length - 10} more`);
            }
        }

        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

searchStudents();