import mongoose from 'mongoose';
import Batch from '../models/batchs.js';
import Registration from '../models/regsitration.js';
import Assignment from '../models/assignment.js';
import dotenv from 'dotenv';

dotenv.config();

const debugBatchAssignment = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    const gauravId = "69eddcf9e6488fd898e2b514";
    const batchId = "69f08527edb45f4fa8ddc802";
    
    console.log('🔍 Checking Gaurav Gupta batch assignment...\n');
    
    // 1. Check Gaurav's registration data
    const gaurav = await Registration.findById(gauravId);
    console.log('📊 Gaurav Registration Data:');
    console.log(`- Student ID: ${gaurav._id}`);
    console.log(`- Name: ${gaurav.studentName}`);
    console.log(`- Batch Array: ${JSON.stringify(gaurav.batch)}`);
    
    // 2. Check batch data
    const batch = await Batch.findById(batchId);
    console.log('\n📚 Batch Data:');
    console.log(`- Batch ID: ${batch._id}`);
    console.log(`- Batch Name: ${batch.batchName}`);
    console.log(`- Students Count: ${batch.students.length}`);
    console.log(`- Students Array: ${JSON.stringify(batch.students)}`);
    
    // 3. Check if Gaurav is in batch students array
    const isGauravInBatch = batch.students.some(studentId => 
      studentId.toString() === gauravId
    );
    console.log(`\n🔗 Is Gaurav in batch students array? ${isGauravInBatch}`);
    
    // 4. Find batches where Gaurav is assigned
    const gauravBatches = await Batch.find({ students: gauravId });
    console.log(`\n📋 Batches where Gaurav is assigned: ${gauravBatches.length}`);
    gauravBatches.forEach(b => {
      console.log(`- ${b.batchName} (${b._id})`);
    });
    
    // 5. Check assignments for this batch
    const assignments = await Assignment.find({ batches: { $in: [batchId] } });
    console.log(`\n📝 Assignments for batch: ${assignments.length}`);
    assignments.forEach(a => {
      console.log(`- ${a.title} (${a._id})`);
    });
    
    // 6. Fix if needed
    if (!isGauravInBatch) {
      console.log('\n🔧 FIXING: Adding Gaurav to batch students array...');
      batch.students.push(gauravId);
      await batch.save();
      console.log('✅ Fixed! Gaurav added to batch.');
    } else {
      console.log('\n✅ Batch assignment is correct!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

debugBatchAssignment();