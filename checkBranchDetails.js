import mongoose from 'mongoose';
import Registration from './models/regsitration.js';
import Branch from './models/branch.js';
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

async function checkBranchDetails() {
    try {
        console.log('🔍 Checking branch details for students...\n');
        
        // Get all branches first
        const allBranches = await Branch.find({});
        const branchMap = {};
        allBranches.forEach(branch => {
            branchMap[branch._id] = branch.name;
        });

        console.log('Available branches:');
        allBranches.forEach((branch, index) => {
            console.log(`${index + 1}. ${branch.name} (ID: ${branch._id})`);
        });
        console.log();

        const results = {
            found: [],
            notFound: [],
            branchGroups: {}
        };

        for (const mobile of mobileNumbers) {
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
                const branchName = branchMap[student.branch] || 'Unknown Branch';
                
                const studentData = {
                    searchMobile: mobile,
                    foundFormat: foundFormat,
                    userid: student.userid,
                    name: student.studentName,
                    branchId: student.branch,
                    branchName: branchName,
                    status: student.status
                };
                
                results.found.push(studentData);
                
                // Group by branch
                if (!results.branchGroups[branchName]) {
                    results.branchGroups[branchName] = [];
                }
                results.branchGroups[branchName].push(studentData);
            } else {
                results.notFound.push(mobile);
            }
        }

        // Display results by branch
        console.log(`📊 BRANCH WISE STUDENT DISTRIBUTION:`);
        console.log(`Total students found: ${results.found.length}`);
        console.log(`Students not found: ${results.notFound.length}\n`);

        // Show students grouped by branch
        Object.keys(results.branchGroups).forEach(branchName => {
            const students = results.branchGroups[branchName];
            console.log(`🏢 ${branchName.toUpperCase()} (${students.length} students):`);
            students.forEach((student, index) => {
                console.log(`   ${index + 1}. ${student.userid} - ${student.name}`);
                console.log(`      Mobile: ${student.foundFormat} | Status: ${student.status}`);
            });
            console.log();
        });

        // Show not found
        if (results.notFound.length > 0) {
            console.log(`❌ NOT FOUND (${results.notFound.length}):`);
            results.notFound.forEach(mobile => console.log(`- ${mobile}`));
            console.log();
        }

        // Summary
        console.log(`📋 BRANCH SUMMARY:`);
        Object.keys(results.branchGroups).forEach(branchName => {
            console.log(`${branchName}: ${results.branchGroups[branchName].length} students`);
        });

        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkBranchDetails();