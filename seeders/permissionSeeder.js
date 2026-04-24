import Permission from '../models/Permission.js';

const permissions = [
  // Dashboard
  { name: 'view_dashboard', description: 'View dashboard', category: 'dashboard' },

  // Student Management
  { name: 'add_student', description: 'Add new student', category: 'student' },
  { name: 'edit_student', description: 'Edit student information', category: 'student' },
  { name: 'delete_student', description: 'Delete student', category: 'student' },
  { name: 'view_students', description: 'View all students', category: 'student' },
  { name: 'view_student_details', description: 'View student details', category: 'student' },
  { name: 'view_registrations', description: 'View new registrations', category: 'student' },
  { name: 'approve_registration', description: 'Approve student registration', category: 'student' },
  { name: 'reject_registration', description: 'Reject student registration', category: 'student' },

  // Fee Management
  { name: 'collect_fee', description: 'Collect fee from students', category: 'fee' },
  { name: 'view_fee_payments', description: 'View fee payments', category: 'fee' },
  { name: 'approve_fee', description: 'Approve fee payment', category: 'fee' },
  { name: 'reject_fee', description: 'Reject fee payment', category: 'fee' },
  { name: 'view_fee_reports', description: 'View fee reports', category: 'fee' },

  // Attendance
  { name: 'mark_attendance', description: 'Mark student attendance', category: 'attendance' },
  { name: 'view_attendance', description: 'View attendance records', category: 'attendance' },
  { name: 'view_attendance_reports', description: 'View attendance reports', category: 'attendance' },

  // Assignments
  { name: 'manage_assignments', description: 'Manage assignments', category: 'assignment' },
  { name: 'grade_assignment', description: 'Grade assignments', category: 'assignment' },
  { name: 'view_assignments', description: 'View assignments', category: 'assignment' },

  // Jobs
  { name: 'manage_company', description: 'Manage companies', category: 'job' },
  { name: 'manage_jobs', description: 'Manage job postings', category: 'job' },
  { name: 'assign_jobs', description: 'Assign jobs to students', category: 'job' },
  { name: 'view_job_applications', description: 'View job applications', category: 'job' },

  // Reports
  { name: 'view_registration_reports', description: 'View registration reports', category: 'report' },

  // Settings
  { name: 'manage_duration', description: 'Manage training duration', category: 'setting' },
  { name: 'manage_training', description: 'Manage training types', category: 'setting' },
  { name: 'manage_technology', description: 'Manage technologies', category: 'setting' },
  { name: 'manage_education', description: 'Manage education levels', category: 'setting' },
  { name: 'manage_course', description: 'Manage courses', category: 'setting' },
  { name: 'manage_college', description: 'Manage colleges', category: 'setting' },
  { name: 'manage_hr', description: 'Manage HR', category: 'setting' },
  { name: 'manage_qrcode', description: 'Manage QR codes', category: 'setting' },
  { name: 'manage_employee', description: 'Manage employees', category: 'setting' },
  { name: 'manage_teacher', description: 'Manage teachers', category: 'setting' },
  { name: 'manage_batch', description: 'Manage batches', category: 'setting' },
  { name: 'manage_branch', description: 'Manage branches', category: 'setting' },
  { name: 'manage_batch_students', description: 'Manage batch students', category: 'setting' },
  { name: 'manage_tags', description: 'Manage tags', category: 'setting' },

  // Profile (no specific permission needed)
];

export const seedPermissions = async () => {
  try {
    console.log('Starting permission seeding...');

    for (const permission of permissions) {
      await Permission.findOneAndUpdate(
        { name: permission.name },
        permission,
        { upsert: true, new: true }
      );
      console.log(`Added/Updated permission: ${permission.name}`);
    }

    console.log('✅ Permissions seeded successfully');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    throw error;
  }
};