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
    
    console.log(`Grouped into ${Object.keys(courseGroups).length} base technologies:`);
    Object.keys(courseGroups).forEach(tech => {
      console.log(`- ${tech}: ${courseGroups[tech].courses.length} courses`);
    });
    
    // Migrate each group
    for (const [baseTechName, group] of Object.entries(courseGroups)) {
      console.log(`\nMigrating ${baseTechName}...`);
      
      // Keep the first course as the main course
      const mainCourse = group.courses[0];
      
      // Update main course with new structure
      mainCourse.baseTechnology = baseTechName;
      mainCourse.relatedTechnologies = [...new Set(group.technologies)]; // Remove duplicates
      
      // Remove old technology field
      mainCourse.technology = undefined;
      
      await mainCourse.save();
      console.log(`✅ Updated main course: ${mainCourse.title}`);
      
      // Delete duplicate courses (keep videos in main course)
      for (let i = 1; i < group.courses.length; i++) {
        const duplicateCourse = group.courses[i];
        
        // Move videos from duplicate course to main course
        const LmsVideo = mongoose.model('LmsVideo');
        await LmsVideo.updateMany(
          { course: duplicateCourse._id },
          { course: mainCourse._id }
        );
        
        console.log(`📹 Moved videos from duplicate course: ${duplicateCourse.title}`);
        
        // Delete duplicate course
        await LmsCourse.findByIdAndDelete(duplicateCourse._id);
        console.log(`🗑️ Deleted duplicate course: ${duplicateCourse.title}`);
      }
      
      // Update video count
      const LmsVideo = mongoose.model('LmsVideo');
      const videoCount = await LmsVideo.countDocuments({ 
        course: mainCourse._id, 
        isActive: true 
      });
      
      mainCourse.videoCount = videoCount;
      await mainCourse.save();
      
      console.log(`📊 Updated video count: ${videoCount}`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Show final results
    const finalCourses = await LmsCourse.find({}).populate('relatedTechnologies', 'name');
    console.log(`\n📋 Final Results:`);
    console.log(`Total courses after migration: ${finalCourses.length}`);
    
    for (const course of finalCourses) {
      console.log(`- ${course.baseTechnology}: ${course.relatedTechnologies.length} durations, ${course.videoCount} videos`);
    }
    
    // Disconnect
    await mongoose.disconnect();
    console.log('\nDisconnected from database');
    
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
};

// Run the migration
migrateLmsCourses();
