// scripts/addMissingPermissions.js
import mongoose from 'mongoose';
import Permission from '../models/Permission.js';
import dotenv from 'dotenv';

dotenv.config();

const missingPermissions = [
    // Batch Permissions
    { name: 'view_batch', description: 'View batches', category: 'settings' },
    { name: 'manage_batch', description: 'Manage batches (create, edit, delete)', category: 'settings' },
    
    // LMS Permissions
    { name: 'view_lms', description: 'View LMS courses and content', category: 'settings' },
    { name: 'manage_lms', description: 'Manage LMS courses and content', category: 'settings' },
    
    // Notification Permissions
    { name: 'view_notifications', description: 'View notifications', category: 'dashboard' },
    { name: 'send_notifications', description: 'Send notifications to users', category: 'dashboard' },
    
    // Referral Permissions
    { name: 'manage_referral', description: 'Manage referral program', category: 'settings' },
    { name: 'view_referrals', description: 'View referral data', category: 'reports' },
    
    // Data Export Permissions
    { name: 'export_data', description: 'Export system data', category: 'reports' },
    { name: 'export_students', description: 'Export student data', category: 'reports' },
    { name: 'export_fees', description: 'Export fee data', category: 'reports' },
    
    // Missing Dashboard Permission
    { name: 'view_dashboard', description: 'Access dashboard', category: 'dashboard' },
];

const addMissingPermissions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        for (const permData of missingPermissions) {
            const existing = await Permission.findOne({ name: permData.name });
            
            if (!existing) {
                const permission = new Permission(permData);
                await permission.save();
                console.log(`✅ Added permission: ${permData.name}`);
            } else {
                console.log(`⚠️  Permission already exists: ${permData.name}`);
            }
        }

        console.log('\n🎉 All missing permissions processed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding permissions:', error);
        process.exit(1);
    }
};

addMissingPermissions();