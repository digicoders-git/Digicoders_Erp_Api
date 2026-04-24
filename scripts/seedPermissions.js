import mongoose from 'mongoose';
import Permission from '../models/Permission.js';
import dotenv from 'dotenv';

dotenv.config();

const permissions = [
  // Dashboard
  { name: 'view_dashboard', description: 'View dashboard', category: 'dashboard' },
  
  // Student Management
  { name: 'add_student', description: 'Add new student', category: 'registrations' },
  { name: 'edit_student', description: 'Edit student information', category: 'registrations' },
  { name: 'view_students', description: 'View all students', category: 'registrations' },
  { name: 'view_registrations', description: 'View new registrations', category: 'registrations' },
  { name: 'approve_registration', description: 'Approve student registration', category: 'registrations' },
  { name: 'reject_registration', description: 'Reject student registration', category: 'registrations' },
  
  // Fee Management
  { name: 'collect_fee', description: 'Collect fee from students', category: 'fees' },
  { name: 'view_fee_payments', description: 'View fee payments', category: 'fees' },
  { name: 'approve_fee', description: 'Approve fee payment', category: 'fees' },
  { name: 'reject_fee', description: 'Reject fee payment', category: 'fees' },
  { name: 'view_fee_reports', description: 'View fee reports', category: 'fees' },
  
  // Attendance
  { name: 'mark_attendance', description: 'Mark student attendance', category: 'attendance' },
  { name: 'view_attendance', description: 'View attendance records', category: 'attendance' },
  { name: 'view_attendance_reports', description: 'View attendance reports', category: 'attendance' },
  
  // Assignments
  { name: 'manage_assignments', description: 'Manage assignments', category: 'assignments' },
  { name: 'grade_assignment', description: 'Grade assignments', category: 'assignments' },
  
  // Jobs
  { name: 'manage_company', description: 'Manage companies', category: 'jobs' },
  { name: 'manage_jobs', description: 'Manage job postings', category: 'jobs' },
  { name: 'assign_jobs', description: 'Assign jobs to students', category: 'jobs' },
  { name: 'view_job_applications', description: 'View job applications', category: 'jobs' },
  
  // Reports
  { name: 'view_registration_reports', description: 'View registration reports', category: 'reports' },
  
  // Settings (Only for Super Admin/Admin)
  { name: 'manage_duration', description: 'Manage training duration', category: 'settings' },
  { name: 'manage_training', description: 'Manage training types', category: 'settings' },
  { name: 'manage_technology', description: 'Manage technologies', category: 'settings' },
  { name: 'manage_education', description: 'Manage education levels', category: 'settings' },
  { name: 'manage_course', description: 'Manage courses', category: 'settings' },
  { name: 'manage_college', description: 'Manage colleges', category: 'settings' },
  { name: 'manage_hr', description: 'Manage HR', category: 'settings' },
  { name: 'manage_qrcode', description: 'Manage QR codes', category: 'settings' },
  { name: 'manage_employee', description: 'Manage employees', category: 'settings' },
  { name: 'manage_teacher', description: 'Manage teachers', category: 'settings' },
  { name: 'manage_batch', description: 'Manage batches', category: 'settings' },
  { name: 'manage_branch', description: 'Manage branches', category: 'settings' },
  { name: 'manage_batch_students', description: 'Manage batch students', category: 'settings' },
];

const seedPermissions = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('Seeding permissions...');
    
    for (const permission of permissions) {
      await Permission.findOneAndUpdate(
        { name: permission.name },
        permission,
        { upsert: true, new: true }
      );
      console.log(`✓ ${permission.name} (${permission.category})`);
    }
    
    console.log('✅ Permissions seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding permissions:', error.message);
    process.exit(1);
  }
};

seedPermissions();