import LmsCourse from '../models/lmsCourse.js';
import LmsVideo from '../models/lmsVideo.js';
import cloudinary from '../config/cloudinary.js';
import fs from 'fs';

// Get courses by technology
const getCoursesByTechnology = async (req, res) => {
  try {
    const { technology } = req.query;
    
    console.log('Fetching courses for technology:', technology);
    
    const courses = await LmsCourse.find({ 
      technology, 
      isActive: true 
    })
    .populate('technology', 'name')
    .sort({ createdAt: -1 });

    // Add video count for each course
    for (let course of courses) {
      const videoCount = await LmsVideo.countDocuments({ 
        course: course._id, 
        isActive: true 
      });
      course.videoCount = videoCount;
    }

    console.log(`Found ${courses.length} courses`);
    
    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch courses'
    });
  }
};

// Create new course
const createCourse = async (req, res) => {
  try {
    const { title, description, technology } = req.body;
    
    console.log('Creating course:', { title, technology });
    console.log('Files received:', req.files);

    if (!title || !technology) {
      return res.status(400).json({
        success: false,
        message: 'Title and technology are required'
      });
    }

    const courseData = {
      title,
      description,
      technology
    };

    // Handle thumbnail upload
    if (req.files && req.files.length > 0) {
      const thumbnailFile = req.files.find(file => file.fieldname === 'thumbnail');
      
      if (thumbnailFile) {
        console.log('Uploading thumbnail to cloudinary...');
        const result = await cloudinary.uploader.upload(thumbnailFile.path, {
          folder: 'lms/course-thumbnails',
          resource_type: 'image'
        });
        
        courseData.thumbnail = {
          url: result.secure_url,
          public_id: result.public_id
        };
        
        // Delete local file
        fs.unlinkSync(thumbnailFile.path);
        console.log('Thumbnail uploaded successfully');
      }
    }

    const course = new LmsCourse(courseData);
    await course.save();
    
    await course.populate('technology', 'name');
    
    console.log('Course created successfully:', course._id);
    
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  } catch (error) {
    console.error('Error creating course:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create course'
    });
  }
};

// Update course
const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, technology } = req.body;
    
    console.log('Updating course:', id, { title, technology });
    console.log('Files received:', req.files);

    const course = await LmsCourse.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Update basic fields
    if (title) course.title = title;
    if (description !== undefined) course.description = description;
    if (technology) course.technology = technology;

    // Handle thumbnail update
    if (req.files && req.files.length > 0) {
      const thumbnailFile = req.files.find(file => file.fieldname === 'thumbnail');
      
      if (thumbnailFile) {
        console.log('Updating thumbnail...');
        
        // Delete old thumbnail from cloudinary
        if (course.thumbnail?.public_id) {
          await cloudinary.uploader.destroy(course.thumbnail.public_id);
        }
        
        // Upload new thumbnail
        const result = await cloudinary.uploader.upload(thumbnailFile.path, {
          folder: 'lms/course-thumbnails',
          resource_type: 'image'
        });
        
        course.thumbnail = {
          url: result.secure_url,
          public_id: result.public_id
        };
        
        // Delete local file
        fs.unlinkSync(thumbnailFile.path);
        console.log('Thumbnail updated successfully');
      }
    }

    await course.save();
    await course.populate('technology', 'name');
    
    console.log('Course updated successfully');
    
    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });
  } catch (error) {
    console.error('Error updating course:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update course'
    });
  }
};

// Delete course
const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Deleting course:', id);
    
    const course = await LmsCourse.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Delete all videos in this course
    const videos = await LmsVideo.find({ course: id });
    for (let video of videos) {
      // Delete video files from cloudinary
      if (video.video?.public_id) {
        await cloudinary.uploader.destroy(video.video.public_id, { resource_type: 'video' });
      }
      if (video.thumbnail?.public_id) {
        await cloudinary.uploader.destroy(video.thumbnail.public_id);
      }
    }
    
    // Delete all videos from database
    await LmsVideo.deleteMany({ course: id });
    
    // Delete course thumbnail from cloudinary
    if (course.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(course.thumbnail.public_id);
    }
    
    // Delete course
    await LmsCourse.findByIdAndDelete(id);
    
    console.log('Course and all videos deleted successfully');
    
    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete course'
    });
  }
};

// Get videos by course
const getVideosByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    console.log('Fetching videos for course:', courseId);
    
    const videos = await LmsVideo.find({ 
      course: courseId, 
      isActive: true 
    })
    .populate('course', 'title')
    .sort({ order: 1, createdAt: 1 });

    console.log(`Found ${videos.length} videos`);
    
    res.json({
      success: true,
      data: videos
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch videos'
    });
  }
};

// Upload video
const uploadVideo = async (req, res) => {
  try {
    const { title, description, course, order } = req.body;
    
    console.log('Uploading video:', { title, course, order });
    console.log('Files received:', req.files);

    if (!title || !course) {
      return res.status(400).json({
        success: false,
        message: 'Title and course are required'
      });
    }

    const videoData = {
      title,
      description,
      course,
      order: parseInt(order) || 0
    };

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        if (file.fieldname === 'video') {
          console.log('Uploading video to cloudinary...');
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'lms/videos',
            resource_type: 'video'
          });
          
          videoData.video = {
            url: result.secure_url,
            public_id: result.public_id
          };
          
          // Delete local file
          fs.unlinkSync(file.path);
          console.log('Video uploaded successfully');
        }
        
        if (file.fieldname === 'thumbnail') {
          console.log('Uploading video thumbnail...');
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'lms/video-thumbnails',
            resource_type: 'image'
          });
          
          videoData.thumbnail = {
            url: result.secure_url,
            public_id: result.public_id
          };
          
          // Delete local file
          fs.unlinkSync(file.path);
          console.log('Video thumbnail uploaded successfully');
        }
      }
    }

    if (!videoData.video) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required'
      });
    }

    const video = new LmsVideo(videoData);
    await video.save();
    
    // Update course video count
    const videoCount = await LmsVideo.countDocuments({ course, isActive: true });
    await LmsCourse.findByIdAndUpdate(course, { videoCount });
    
    await video.populate('course', 'title');
    
    console.log('Video uploaded successfully:', video._id);
    
    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: video
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to upload video'
    });
  }
};

// Update video
const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, order } = req.body;
    
    console.log('Updating video:', id, { title, order });
    console.log('Files received:', req.files);

    const video = await LmsVideo.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    // Update basic fields
    if (title) video.title = title;
    if (description !== undefined) video.description = description;
    if (order !== undefined) video.order = parseInt(order) || 0;

    // Handle file updates
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        if (file.fieldname === 'video') {
          console.log('Updating video file...');
          
          // Delete old video from cloudinary
          if (video.video?.public_id) {
            await cloudinary.uploader.destroy(video.video.public_id, { resource_type: 'video' });
          }
          
          // Upload new video
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'lms/videos',
            resource_type: 'video'
          });
          
          video.video = {
            url: result.secure_url,
            public_id: result.public_id
          };
          
          // Delete local file
          fs.unlinkSync(file.path);
          console.log('Video file updated successfully');
        }
        
        if (file.fieldname === 'thumbnail') {
          console.log('Updating video thumbnail...');
          
          // Delete old thumbnail from cloudinary
          if (video.thumbnail?.public_id) {
            await cloudinary.uploader.destroy(video.thumbnail.public_id);
          }
          
          // Upload new thumbnail
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'lms/video-thumbnails',
            resource_type: 'image'
          });
          
          video.thumbnail = {
            url: result.secure_url,
            public_id: result.public_id
          };
          
          // Delete local file
          fs.unlinkSync(file.path);
          console.log('Video thumbnail updated successfully');
        }
      }
    }

    await video.save();
    await video.populate('course', 'title');
    
    console.log('Video updated successfully');
    
    res.json({
      success: true,
      message: 'Video updated successfully',
      data: video
    });
  } catch (error) {
    console.error('Error updating video:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update video'
    });
  }
};

// Delete video
const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Deleting video:', id);
    
    const video = await LmsVideo.findById(id);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found'
      });
    }

    const courseId = video.course;

    // Delete video files from cloudinary
    if (video.video?.public_id) {
      await cloudinary.uploader.destroy(video.video.public_id, { resource_type: 'video' });
    }
    if (video.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(video.thumbnail.public_id);
    }
    
    // Delete video from database
    await LmsVideo.findByIdAndDelete(id);
    
    // Update course video count
    const videoCount = await LmsVideo.countDocuments({ course: courseId, isActive: true });
    await LmsCourse.findByIdAndUpdate(courseId, { videoCount });
    
    console.log('Video deleted successfully');
    
    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete video'
    });
  }
};

export {
  getCoursesByTechnology,
  createCourse,
  updateCourse,
  deleteCourse,
  getVideosByCourse,
  uploadVideo,
  updateVideo,
  deleteVideo
};