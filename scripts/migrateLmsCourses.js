import mongoose from 'mongoose';
import LmsCourse from '../models/lmsCourse.js';
import Technology from '../models/technology.js';
import dotenv from 'dotenv';

dotenv.config();

const migrateLmsCourses = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to database');

    // Get all existing LMS courses
    const existingCourses = await LmsCourse.find({}).populate('technology', 'name');
    
    console.log(`Found ${existingCourses.length} existing courses to migrate`);
    
    // Group courses by base technology name
    const courseGroups = {};
    
    for (const course of existingCourses) {
      if (!course.technology) continue;
      
      const baseTechName = course.technology.name;
      
      if (!courseGroups[baseTechName]) {
        courseGroups[baseTechName] = {
          courses: [],
          technologies: []
        };
      }
      
      courseGroups[baseTechName].courses.push(course);
      courseGroups[baseTechName].technologies.push(course.technology._id);
    }
    
    console.log(`Grouped into ${Object.keys(courseGroups).length} base technologies:`);\n    Object.keys(courseGroups).forEach(tech => {\n      console.log(`- ${tech}: ${courseGroups[tech].courses.length} courses`);\n    });\n    \n    // Migrate each group\n    for (const [baseTechName, group] of Object.entries(courseGroups)) {\n      console.log(`\\nMigrating ${baseTechName}...`);\n      \n      // Keep the first course as the main course\n      const mainCourse = group.courses[0];\n      \n      // Update main course with new structure\n      mainCourse.baseTechnology = baseTechName;\n      mainCourse.relatedTechnologies = [...new Set(group.technologies)]; // Remove duplicates\n      \n      // Remove old technology field\n      mainCourse.technology = undefined;\n      \n      await mainCourse.save();\n      console.log(`✅ Updated main course: ${mainCourse.title}`);\n      \n      // Delete duplicate courses (keep videos in main course)\n      for (let i = 1; i < group.courses.length; i++) {\n        const duplicateCourse = group.courses[i];\n        \n        // Move videos from duplicate course to main course\n        const LmsVideo = mongoose.model('LmsVideo');\n        await LmsVideo.updateMany(\n          { course: duplicateCourse._id },\n          { course: mainCourse._id }\n        );\n        \n        console.log(`📹 Moved videos from duplicate course: ${duplicateCourse.title}`);\n        \n        // Delete duplicate course\n        await LmsCourse.findByIdAndDelete(duplicateCourse._id);\n        console.log(`🗑️ Deleted duplicate course: ${duplicateCourse.title}`);\n      }\n      \n      // Update video count\n      const LmsVideo = mongoose.model('LmsVideo');\n      const videoCount = await LmsVideo.countDocuments({ \n        course: mainCourse._id, \n        isActive: true \n      });\n      \n      mainCourse.videoCount = videoCount;\n      await mainCourse.save();\n      \n      console.log(`📊 Updated video count: ${videoCount}`);\n    }\n    \n    console.log('\\n✅ Migration completed successfully!');\n    \n    // Show final results\n    const finalCourses = await LmsCourse.find({}).populate('relatedTechnologies', 'name');\n    console.log(`\\n📋 Final Results:`);\n    console.log(`Total courses after migration: ${finalCourses.length}`);\n    \n    for (const course of finalCourses) {\n      console.log(`- ${course.baseTechnology}: ${course.relatedTechnologies.length} durations, ${course.videoCount} videos`);\n    }\n    \n    // Disconnect\n    await mongoose.disconnect();\n    console.log('\\nDisconnected from database');\n    \n  } catch (error) {\n    console.error('Migration error:', error);\n    process.exit(1);\n  }\n};\n\n// Run the migration\nmigrateLmsCourses();