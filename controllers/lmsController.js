import LmsCourse from '../models/lmsCourse.js';
import LmsVideo from '../models/lmsVideo.js';
import Technology from '../models/technology.js';
import fs from 'fs';

// Get courses by base technology name
const getCoursesByTechnology = async (req, res) => {
  try {
    const { technology } = req.query;
    
    // Get the technology details to extract base name
    const techDetails = await Technology.findById(technology).populate('duration', 'name');
    if (!techDetails) {
      return res.status(404).json({
        success: false,
        message: 'Technology not found'
      });
    }
    
    const baseTechnologyName = techDetails.name; // e.g., "Java"
    
    // Find courses by base technology name
    const courses = await LmsCourse.find({ 
      baseTechnology: baseTechnologyName, 
      isActive: true 
    })
    .populate('relatedTechnologies', 'name duration price')
    .populate({
      path: 'relatedTechnologies',
      populate: {
        path: 'duration',
        select: 'name'
      }
    })
    .sort({ createdAt: -1 });

    // Add video count for each course
    for (let course of courses) {
      const videoCount = await LmsVideo.countDocuments({ 
        course: course._id, 
        isActive: true 
      });
      course.videoCount = videoCount;
    }
    
    res.json({
      success: true,
      data: courses,
      baseTechnology: baseTechnologyName,
      availableDurations: techDetails ? [techDetails] : []
    });
  } catch (error) {
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

    if (!title || !technology) {
      return res.status(400).json({
        success: false,
        message: 'Title and technology are required'
      });
    }

    // Get technology details to extract base name
    const techDetails = await Technology.findById(technology).populate('duration', 'name');
    if (!techDetails) {
      return res.status(400).json({
        success: false,
        message: 'Invalid technology ID'
      });
    }

    const baseTechnologyName = techDetails.name; // e.g., "Java"
    
    // Check if course already exists for this base technology
    let existingCourse = await LmsCourse.findOne({ 
      baseTechnology: baseTechnologyName,
      isActive: true 
    });
    
    if (existingCourse) {
      // Add this technology to existing course if not already present
      if (!existingCourse.relatedTechnologies.includes(technology)) {
        existingCourse.relatedTechnologies.push(technology);
        await existingCourse.save();
      }
      
      await existingCourse.populate('relatedTechnologies', 'name duration price');
      
      return res.status(200).json({
        success: true,
        message: `Course already exists for ${baseTechnologyName}. Added new duration.`,
        data: existingCourse
      });
    }

    // Create new course
    const courseData = {
      title,
      description,
      baseTechnology: baseTechnologyName,
      relatedTechnologies: [technology]
    };

    // Handle thumbnail upload
    if (req.files && req.files.length > 0) {
      const thumbnailFile = req.files.find(file => file.fieldname === 'thumbnail');
      
      if (thumbnailFile) {
        courseData.thumbnail = {
          url: `/uploads/${thumbnailFile.filename}`,
          public_id: thumbnailFile.filename
        };
      }
    }

    const course = new LmsCourse(courseData);
    await course.save();
    
    await course.populate('relatedTechnologies', 'name duration price');
    
    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      data: course
    });
  } catch (error) {
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
        // Delete old thumbnail file if exists
        if (course.thumbnail?.public_id && course.thumbnail.url.startsWith('/uploads/')) {
          const oldFilePath = `uploads/${course.thumbnail.public_id}`;
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        
        course.thumbnail = {
          url: `/uploads/${thumbnailFile.filename}`,
          public_id: thumbnailFile.filename
        };
      }
    }

    await course.save();
    await course.populate('technology', 'name');
    
    res.json({
      success: true,
      message: 'Course updated successfully',
      data: course
    });
  } catch (error) {
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
        }
      }
      if (video.thumbnail?.public_id && video.thumbnail.url.startsWith('/uploads/')) {
        const thumbnailPath = `uploads/${video.thumbnail.public_id}`;
        if (fs.existsSync(thumbnailPath)) {
          fs.unlinkSync(thumbnailPath);
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
      }
    }
    
    // Delete course
    await LmsCourse.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Course deleted successfully'
    });
  } catch (error) {
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
    
    const videos = await LmsVideo.find({ 
      course: courseId, 
      isActive: true 
    })
    .populate('course', 'title')
    .sort({ order: 1, createdAt: 1 });
    
    res.json({
      success: true,
      data: videos
    });
  } catch (error) {
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
          videoData.video = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
        }
        
        if (file.fieldname === 'thumbnail') {
          videoData.thumbnail = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
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
    
    res.status(201).json({
      success: true,
      message: 'Video uploaded successfully',
      data: video
    });
  } catch (error) {
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
          // Delete old video file if exists
          if (video.video?.public_id && video.video.url.startsWith('/uploads/')) {
            const oldFilePath = `uploads/${video.video.public_id}`;
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }
          
          video.video = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
        }
        
        if (file.fieldname === 'thumbnail') {
          // Delete old thumbnail file if exists
          if (video.thumbnail?.public_id && video.thumbnail.url.startsWith('/uploads/')) {
            const oldFilePath = `uploads/${video.thumbnail.public_id}`;
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          }
          
          video.thumbnail = {
            url: `/uploads/${file.filename}`,
            public_id: file.filename
          };
        }
      }
    }

    await video.save();
    await video.populate('course', 'title');
    
    res.json({
      success: true,
      message: 'Video updated successfully',
      data: video
    });
  } catch (error) {
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
      }
    }
    if (video.thumbnail?.public_id && video.thumbnail.url.startsWith('/uploads/')) {
      const thumbnailPath = `uploads/${video.thumbnail.public_id}`;
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    
    // Delete video from database
    await LmsVideo.findByIdAndDelete(id);
    
    // Update course video count
    const videoCount = await LmsVideo.countDocuments({ course: courseId, isActive: true });
    await LmsCourse.findByIdAndUpdate(courseId, { videoCount });
    
    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete video'
    });
  }
};

// Get all base technologies (unique technology names)
const getBaseTechnologies = async (req, res) => {
  try {
    // Get all unique base technology names from LMS courses
    const baseTechnologies = await LmsCourse.distinct('baseTechnology', { isActive: true });
    
    // Get related technologies for each base technology
    const technologiesWithDetails = [];
    
    for (const baseTech of baseTechnologies) {
      const course = await LmsCourse.findOne({ 
        baseTechnology: baseTech, 
        isActive: true 
      }).populate('relatedTechnologies', 'name duration price');
      
      if (course) {
        technologiesWithDetails.push({
          baseTechnology: baseTech,
          availableDurations: course.relatedTechnologies,
          courseCount: 1, // Since we group by base technology
          videoCount: course.videoCount || 0
        });
      }
    }
    
    res.json({
      success: true,
      data: technologiesWithDetails
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch base technologies'
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
  deleteVideo,
  getBaseTechnologies
};