import mongoose from 'mongoose';
import Registration from './models/regsitration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI);

const mobileNumbers = [
    '+91 72752 41683',
    '+91 63883 02696',
    '+91 70528 10036',
    '+91 98382 03971',
    '+91 97213 03772',
    '+91 93896 92215',
    '+91 93695 72641',
    '+91 93681 31374',
    '+91 93367 12730',
    '+91 92357 90193',
    '+91 92347 16100',
    '+91 91513 46503',
    '+91 95805 67369',
    '+91 91513 46503',
    '+91 81820 25019',
    '+91 73512 38134',
    '+91 73185 09936',
    '+91 84291 14622',
    '+91 89380 52968',
    '+91 88810 37319',
    '+91 88580 93605',
    '+91 77868 51828',
    '+91 70803 84915',
    '+91 72752 41683',
    '+91 72758 34190',
    '+91 74578 89516',
    '+91 73512 38134',
    '+91 76684 28795',
    '+91 79918 33566',
    '+91 80098 37964',
    '+91 81820 25019',
    '+91 84005 06799',
    '+91 87564 44673',
    '+91 88698 29442',
    '+91 89240 37664'
];

async function checkStudentTraining() {
    try {
        console.log('🔍 Checking students training type...\n');
        
        const results = {
            found: [],
            notFound: [],
            offlineStudents: []
        };

        for (const mobile of mobileNumbers) {
            const student = await Registration.findOne({ mobile: mobile })
                .populate('training', 'name type')
                .populate('technology', 'name')
                .populate('hrName', 'name')
                .populate('branch', 'name');
            
            if (student) {
                results.found.push({
                    userid: student.userid,
                    name: student.studentName,
                    mobile: student.mobile,
                    trainingType: student.training?.type || 'N/A',
                    trainingName: student.training?.name || 'N/A',
                    technology: student.technology?.name || 'N/A',
                    hrName: student.hrName?.name || 'N/A',
                    branch: student.branch?.name || 'N/A',
                    status: student.status
                });

                if (student.training?.type === 'Offline') {
                    results.offlineStudents.push(student);
                }
            } else {
                results.notFound.push(mobile);
            }
        }

        // Display results
        console.log(`📊 RESULTS SUMMARY:`);
        console.log(`Total numbers checked: ${mobileNumbers.length}`);
        console.log(`Students found: ${results.found.length}`);
        console.log(`Students not found: ${results.notFound.length}`);
        console.log(`Offline students found: ${results.offlineStudents.length}\n`);

        // Show found students
        if (results.found.length > 0) {
            console.log('📋 FOUND STUDENTS:');
            results.found.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.name}`);
                console.log(`   Mobile: ${student.mobile}`);
                console.log(`   Training: ${student.trainingType} (${student.trainingName})`);
                console.log(`   Technology: ${student.technology}`);
                console.log(`   HR: ${student.hrName} | Branch: ${student.branch}`);
                console.log(`   Status: ${student.status}\n`);
            });
        }

        // Show not found
        if (results.notFound.length > 0) {
            console.log('❌ NOT FOUND NUMBERS:');
            results.notFound.forEach((mobile, index) => {
                console.log(`${index + 1}. ${mobile}`);
            });
            console.log();
        }

        // Show offline students that need to be updated
        if (results.offlineStudents.length > 0) {
            console.log('⚠️  OFFLINE STUDENTS FOUND (Need to update to Online):');
            results.offlineStudents.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.studentName}`);
                console.log(`   Mobile: ${student.mobile}`);
                console.log(`   Current Training: ${student.training?.type} (${student.training?.name})`);
                console.log(`   Technology: ${student.technology?.name}`);
                console.log(`   Status: ${student.status}\n`);
            });
            console.log(`📝 Found ${results.offlineStudents.length} students in offline training that need to be moved to online.`);
        } else {
            console.log('✅ No offline students found - all students are already in online training!');
        }

        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkStudentTraining();