import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const createSuperAdmin = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check if Super Admin already exists
    const existingSuperAdmin = await User.findOne({ role: "Super Admin" });
    if (existingSuperAdmin) {
      console.log('Super Admin already exists:', existingSuperAdmin.email);
      process.exit(0);
    }
    
    // Create Super Admin

    
    const superAdmin = new User({
      name: 'Super Admin',
      email: 'superadmin@erp.com',
      password: "Admin@123",
      role: 'Super Admin',
      isSuperAdmin: true,
      isVerified: true,
      isActive: true,
      phone: '9876543210'
    });
    
    await superAdmin.save();
    
    console.log('✅ Super Admin created successfully!');
    console.log('Email: superadmin@erp.com');
    console.log('Password: Admin@123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating Super Admin:', error.message);
    process.exit(1);
  }
};

createSuperAdmin();