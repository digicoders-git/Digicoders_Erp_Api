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

async function moveOfflineToOnline() {
    try {
        console.log('🔄 Moving offline students to online branch...\n');
        
        // Get all branches
        const allBranches = await Branch.find({});
        const branchMap = {};
        allBranches.forEach(branch => {
            branchMap[branch._id] = branch.name;
        });

        // Find online branch ID
        const onlineBranch = allBranches.find(branch => 
            branch.name.toLowerCase().includes('online') || 
            branch.name.toLowerCase().includes('virtual')
        );

        if (!onlineBranch) {
            console.log('❌ Online branch not found!');
            process.exit(1);
        }

        console.log(`🎯 Target Online Branch: ${onlineBranch.name} (ID: ${onlineBranch._id})\n`);

        const results = {
            found: [],
            notFound: [],
            offlineStudents: [],
            updated: [],
            alreadyOnline: []
        };

        // First, identify all students and their current branches
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
                    _id: student._id,
                    userid: student.userid,
                    name: student.studentName,
                    mobile: foundFormat,
                    currentBranchId: student.branch,
                    currentBranchName: branchName,
                    isOffline: branchName.toLowerCase().includes('offline')
                };
                
                results.found.push(studentData);
                
                if (studentData.isOffline) {
                    results.offlineStudents.push(studentData);
                } else {
                    results.alreadyOnline.push(studentData);
                }
            } else {
                results.notFound.push(mobile);
            }
        }

        console.log(`📊 ANALYSIS BEFORE UPDATE:`);
        console.log(`Total students found: ${results.found.length}`);
        console.log(`Offline students (need to move): ${results.offlineStudents.length}`);
        console.log(`Already online: ${results.alreadyOnline.length}`);
        console.log(`Not found: ${results.notFound.length}\n`);

        // Show students that will be moved
        if (results.offlineStudents.length > 0) {
            console.log(`🔄 STUDENTS TO BE MOVED TO ONLINE (${results.offlineStudents.length}):`);
            results.offlineStudents.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.name}`);
                console.log(`   From: ${student.currentBranchName} → To: ${onlineBranch.name}`);
                console.log(`   Mobile: ${student.mobile}\n`);
            });

            // Ask for confirmation (in real scenario)
            console.log('🚀 STARTING UPDATE PROCESS...\n');

            // Update students one by one
            for (const student of results.offlineStudents) {
                try {
                    await Registration.updateOne(
                        { _id: student._id },
                        { 
                            $set: { 
                                branch: onlineBranch._id,
                                updatedAt: new Date()
                            }
                        }
                    );
                    
                    results.updated.push({
                        userid: student.userid,
                        name: student.name,
                        mobile: student.mobile,
                        fromBranch: student.currentBranchName,
                        toBranch: onlineBranch.name
                    });
                    
                    console.log(`✅ Updated: ${student.userid} - ${student.name}`);
                } catch (error) {
                    console.log(`❌ Failed to update ${student.userid}: ${error.message}`);
                }
            }
            
            console.log(`\n🎉 UPDATE COMPLETED!`);
            console.log(`✅ Successfully moved ${results.updated.length} students to online branch`);
            
            if (results.updated.length > 0) {
                console.log(`\n📋 MOVED STUDENTS:`);
                results.updated.forEach((student, index) => {
                    console.log(`${index + 1}. ${student.userid} - ${student.name} (${student.mobile})`);
                });
            }
        } else {
            console.log('✅ No offline students found to move!');
        }

        // Show students already online
        if (results.alreadyOnline.length > 0) {
            console.log(`\n🟢 STUDENTS ALREADY IN ONLINE BRANCH (${results.alreadyOnline.length}):`);
            results.alreadyOnline.forEach((student, index) => {
                console.log(`${index + 1}. ${student.userid} - ${student.name} (${student.mobile})`);
            });
        }

        console.log(`\n📊 FINAL SUMMARY:`);
        console.log(`🔄 Students moved to online: ${results.updated.length}`);
        console.log(`🟢 Already online: ${results.alreadyOnline.length}`);
        console.log(`❌ Not found: ${results.notFound.length}`);
        console.log(`📱 Total processed: ${results.found.length}/${mobileNumbers.length}`);

        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

moveOfflineToOnline();