import mongoose from 'mongoose';
import Registration from './models/regsitration.js';
import Training from './models/tranning.js';
import dotenv from 'dotenv';

dotenv.config();
mongoose.connect(process.env.MONGODB_URI);

async function findTrainingTypes() {
    try {
        console.log('🔍 Analyzing training types and patterns...\n');

        // Get all trainings with their data
        const allTrainings = await Training.find({}).populate('duration');
        console.log('All available trainings:');
        allTrainings.forEach((training, index) => {
            console.log(`${index + 1}. ${training.name}`);
            console.log(`   Duration: ${training.duration?.name || 'N/A'}`);
            console.log(`   Registration Amount: ₹${training.registrationAmount || 0}`);
            console.log(`   Active: ${training.isActive}\n`);
        });

        // Check if any student record has 'trainingType' field directly
        const sampleStudent = await Registration.findOne({}).select('trainingType training');
        console.log('Sample student training info:', {
            trainingType: sampleStudent?.trainingType || 'Field not found',
            training: sampleStudent?.training
        });

        // Check the schema for any trainingType field
        const registrationSchema = Registration.schema;
        const trainingTypeField = registrationSchema.paths.trainingType;
        
        if (trainingTypeField) {
            console.log('\n✅ trainingType field found in Registration schema:');
            console.log('Enum values:', trainingTypeField.enumValues);
        } else {
            console.log('\n❌ No trainingType field found in Registration schema');
        }

        // Try to find if training type is inferred from training names
        console.log('\n🔍 Checking if training type can be inferred from names...');
        
        // Common patterns for offline/online training names
        const offlineKeywords = ['offline', 'industrial', 'project', 'vocational', 'apprenticeship'];
        const onlineKeywords = ['online', 'summer', 'winter'];
        
        allTrainings.forEach(training => {
            const name = training.name.toLowerCase();
            let inferredType = 'Unknown';
            
            if (offlineKeywords.some(keyword => name.includes(keyword))) {
                inferredType = 'Offline';
            } else if (onlineKeywords.some(keyword => name.includes(keyword))) {
                inferredType = 'Online';
            }
            
            console.log(`${training.name} → ${inferredType}`);
        });

        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

findTrainingTypes();