import mongoose from 'mongoose';
import Registration from './models/regsitration.js';
import Training from './models/tranning.js';
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

async function checkTrainingDetails() {
    try {
        console.log('🔍 Checking training details for students...\n');
        
        const results = {
            found: [],
            notFound: [],
            offlineStudents: []
        };

        // Get all training types first
        const allTrainings = await Training.find({});
        const trainingMap = {};
        allTrainings.forEach(training => {
            trainingMap[training._id] = {
                name: training.name,
                type: training.type
            };
        });

        console.log('Available training types:');
        allTrainings.forEach((training, index) => {
            console.log(`${index + 1}. ${training.name} - ${training.type}`);
        });
        console.log();

        for (const mobile of mobileNumbers) {
            // Try different formats
            const variations = [mobile, `+91 ${mobile}`, `+91${mobile}`, `91${mobile}`];
            let student = null;
            let foundFormat = '';

            for (const variation of variations) {
                student = await Registration.findOne({ mobile: variation });
                if (student) {
                    foundFormat = variation;
                    break;
                }
            }
            
            if (student) {
                const trainingInfo = trainingMap[student.training] || { name: 'Unknown', type: 'Unknown' };
                
                const studentData = {
                    searchMobile: mobile,
                    foundFormat: foundFormat,
                    userid: student.userid,
                    name: student.studentName,
                    trainingId: student.training,
                    trainingName: trainingInfo.name,
                    trainingType: trainingInfo.type,
                    status: student.status
                };
                
                results.found.push(studentData);
                
                if (trainingInfo.type === 'Offline') {
                    results.offlineStudents.push(studentData);
                }
            } else {
                results.notFound.push(mobile);
            }
        }

        // Display results
        console.log(`📊 DETAILED RESULTS:`);
        console.log(`Total numbers checked: ${mobileNumbers.length}`);
        console.log(`Students found: ${results.found.length}`);
        console.log(`Students not found: ${results.notFound.length}`);
        console.log(`Offline students found: ${results.offlineStudents.length}\n`);

        // Show offline students first (most important)
        if (results.offlineStudents.length > 0) {
            console.log('🔴 OFFLINE STUDENTS (NEED TO UPDATE TO ONLINE):');
            results.offlineStudents.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.name}`);
                console.log(`   Mobile: ${student.foundFormat}`);
                console.log(`   Training: ${student.trainingName} (${student.trainingType})`);
                console.log(`   Status: ${student.status}\n`);
            });
        } else {
            console.log('✅ No offline students found!\n');
        }

        // Show online students
        const onlineStudents = results.found.filter(s => s.trainingType === 'Online');
        if (onlineStudents.length > 0) {
            console.log(`🟢 ONLINE STUDENTS (${onlineStudents.length}):`);
            onlineStudents.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.name} | ${student.trainingName}`);
            });
            console.log();
        }

        // Show not found
        if (results.notFound.length > 0) {
            console.log(`❌ NOT FOUND (${results.notFound.length}):`);
            results.notFound.forEach(mobile => console.log(`- ${mobile}`));
        }

        console.log(`\n📋 SUMMARY:`);
        console.log(`🔴 Offline: ${results.offlineStudents.length}`);
        console.log(`🟢 Online: ${onlineStudents.length}`);
        console.log(`❌ Not found: ${results.notFound.length}`);

        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkTrainingDetails();