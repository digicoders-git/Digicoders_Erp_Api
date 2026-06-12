
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Registration from './models/regsitration.js';
import Fee from './models/fee.js';
import Attendance from './models/attendance.js';

dotenv.config();

const fixIndices = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Dropping indices for Registration...');
        try {
            await Registration.collection.dropIndex('tnxId_1');
            console.log('Dropped tnxId_1 index from Registration');
        } catch (e) {
            console.log('tnxId_1 index not found in Registration or error dropping it');
        }

        console.log('Dropping indices for Fee...');
        try {
            await Fee.collection.dropIndex('tnxId_1');
            console.log('Dropped tnxId_1 index from Fee');
        } catch (e) {
            console.log('tnxId_1 index not found in Fee or error dropping it');
        }

        console.log('Dropping indices for Attendance...');
        try {
            await Attendance.collection.dropIndex('batch_1_date_1');
            console.log('Dropped batch_1_date_1 index from Attendance');
        } catch (e) {
            console.log('batch_1_date_1 index not found in Attendance or error dropping it');
        }

        console.log('Re-syncing indexes...');
        await Registration.syncIndexes();
        await Fee.syncIndexes();
        await Attendance.syncIndexes();
        console.log('Indices re-synced');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixIndices();
