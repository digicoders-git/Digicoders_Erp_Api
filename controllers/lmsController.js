import LmsCourse from '../models/lmsCourse.js';
import LmsVideo from '../models/lmsVideo.js';
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

    // Handle thumbnail upload - Save locally instead of Cloudinary
    if (req.files && req.files.length > 0) {
      const thumbnailFile = req.files.find(file => file.fieldname === 'thumbnail');
      
      if (thumbnailFile) {
        console.log('Saving thumbnail locally:', thumbnailFile.filename);
        
        courseData.thumbnail = {
          url: `/uploads/${thumbnailFile.filename}`,
          public_id: thumbnailFile.filename
        };
        
        console.log('Thumbnail saved locally:', courseData.thumbnail.url);
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

    // Handle thumbnail update - Save locally
    if (req.files && req.files.length > 0) {
      const thumbnailFile = req.files.find(file => file.fieldname === 'thumbnail');
      
      if (thumbnailFile) {
        console.log('Updating thumbnail locally:', thumbnailFile.filename);
        
        // Delete old thumbnail file if exists
        if (course.thumbnail?.public_id && course.thumbnail.url.startsWith('/uploads/')) {
          const oldFilePath = `uploads/${course.thumbnail.public_id}`;
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log('Deleted old thumbnail:', oldFilePath);
          }
        }
        
        course.thumbnail = {
          url: `/uploads/${thumbnailFile.filename}`,
          public_id: thumbnailFile.filename
        };
        
        console.log('Thumbnail updated locally:', course.thumbnail.url);
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
      // Delete video files from local storage
      if (video.video?.public_id && video.video.url.startsWith('/uploads/')) {
        const videoPath = `uploads/${video.video.public_id}`;
        if (fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
          console.log('Deleted video file:', videoPath);
        }
      }
      if (video.thumbnail?.public_id && video.thumbnail.url.startsWith('/uploads/')) {
        const thumbnailPath = `uploads/${video.thumbnail.public_id}`;
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
          console.log('Deleted video thumbnail:', thumbnailPath);
        }
      }
    }
    
    // Delete all videos from database
    await LmsVideo.deleteMany({ course: id });
    
    // Delete course thumbnail from local storage
    if (course.thumbnail?.public_id && course.thumbnail.url.startsWith('/uploads/')) {
      const thumbnailPath = `uploads/${course.thumbnail.public_id}`;
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
        console.log('Deleted course thumbnail:', thumbnailPath);
      }
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

    // Handle file uploads - Save locally
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        if (file.fieldname === 'video') {
          console.log('Saving video locally:', file.filename);
          
          videoData.video = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
          
          console.log('Video saved locally:', videoData.video.url);
        }
        
        if (file.fieldname === 'thumbnail') {
          console.log('Saving video thumbnail locally:', file.filename);
          
          videoData.thumbnail = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
          
          console.log('Video thumbnail saved locally:', videoData.thumbnail.url);
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

    // Handle file updates - Save locally
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        if (file.fieldname === 'video') {
          console.log('Updating video file locally:', file.filename);
          
          // Delete old video file if exists
          if (video.video?.public_id && video.video.url.startsWith('/uploads/')) {
            const oldFilePath = `uploads/${video.video.public_id}`;
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log('Deleted old video:', oldFilePath);
            }
          }
          
          video.video = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
          
          console.log('Video file updated locally:', video.video.url);
        }
        
        if (file.fieldname === 'thumbnail') {
          console.log('Updating video thumbnail locally:', file.filename);
          
          // Delete old thumbnail file if exists
          if (video.thumbnail?.public_id && video.thumbnail.url.startsWith('/uploads/')) {
            const oldFilePath = `uploads/${video.thumbnail.public_id}`;
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log('Deleted old thumbnail:', oldFilePath);
            }
          }
          
          video.thumbnail = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
          
          console.log('Video thumbnail updated locally:', video.thumbnail.url);
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

    // Delete video files from local storage
    if (video.video?.public_id && video.video.url.startsWith('/uploads/')) {
      const videoPath = `uploads/${video.video.public_id}`;
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log('Deleted video file:', videoPath);
      }
    }
    if (video.thumbnail?.public_id && video.thumbnail.url.startsWith('/uploads/')) {
      const thumbnailPath = `uploads/${video.thumbnail.public_id}`;
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
        console.log('Deleted video thumbnail:', thumbnailPath);
      }
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