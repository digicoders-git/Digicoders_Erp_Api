import BatchReminder from '../models/BatchReminder.js';
import Batch from '../models/batchs.js';
import Registration from '../models/regsitration.js';
import FcmToken from '../models/FcmToken.js';
import admin from '../config/firebase.js';
import mongoose from 'mongoose';
import { sendSmsReminder as sendSMS } from '../utils/sendSMS.js';
import { sendEmail } from '../utils/sendEmail.js';

// Create batch reminder
export const createBatchReminder = async (req, res) => {
  try {
    const {
      batchId,
      reminderType,
      customMessage,
      soundUrl,
      soundName,
      minutesBefore,
      notificationSettings
    } = req.body;

    // Validate batch exists
    const batch = await Batch.findById(batchId)
      .populate('trainingType', 'name')
      .populate('students', 'studentName mobile email');
      
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    if (!batch.students || batch.students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No students found in this batch'
      });
    }

    // Generate message based on type
    let message = customMessage;
    if (reminderType === 'start_soon') {
      message = customMessage || `🔔 ${batch.trainingType?.name || 'Your'} batch "${batch.batchName}" starts in ${minutesBefore} minutes! Please join on time. 📚`;
    } else if (reminderType === 'starting_now') {
      message = customMessage || `⏰ URGENT: ${batch.trainingType?.name || 'Your'} batch "${batch.batchName}" is starting NOW! Please join immediately. 🚀`;
    }

    // Calculate scheduled time
    let scheduledTime;
    if (reminderType === 'starting_now') {
      scheduledTime = new Date(batch.startDate);
    } else {
      scheduledTime = new Date(batch.startDate.getTime() - (minutesBefore * 60 * 1000));
    }

    // Create reminder
    const reminder = await BatchReminder.create({
      batchId,
      reminderType,
      message,
      soundUrl: soundUrl || null,
      soundName: soundName || 'Default',
      minutesBefore: reminderType === 'starting_now' ? 0 : minutesBefore,
      scheduledTime,
      createdBy: req.user._id,
      notificationSettings: {
        playSound: notificationSettings?.playSound !== false,
        soundVolume: notificationSettings?.soundVolume || 80,
        vibrate: notificationSettings?.vibrate !== false,
        priority: notificationSettings?.priority || 'high'
      }
    });

    const populatedReminder = await BatchReminder.findById(reminder._id);

    return res.status(201).json({
      success: true,
      message: 'Batch reminder created successfully',
      data: populatedReminder
    });
  } catch (error) {
    console.error('Create batch reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Send batch reminder immediately
export const sendBatchReminderNow = async (req, res) => {
  try {
    const { batchId, message, soundUrl, soundName, notificationSettings } = req.body;

    const batch = await Batch.findById(batchId)
      .populate('trainingType', 'name')
      .populate('students', 'studentName mobile email');
      
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    if (!batch.students || batch.students.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No students found in this batch'
      });
    }

    const finalMessage = message || `🔔 ${batch.trainingType?.name || 'Your'} batch "${batch.batchName}" reminder from DigiCoders! 📚`;

    // Create immediate reminder record
    const reminder = await BatchReminder.create({
      batchId,
      reminderType: 'custom',
      message: finalMessage,
      soundUrl: soundUrl || null,
      soundName: soundName || 'Default',
      minutesBefore: 0,
      scheduledTime: new Date(),
      status: 'sending',
      createdBy: req.user._id,
      notificationSettings: {
        playSound: notificationSettings?.playSound !== false,
        soundVolume: notificationSettings?.soundVolume || 80,
        vibrate: notificationSettings?.vibrate !== false,
        priority: notificationSettings?.priority || 'high'
      }
    });

    // Send notifications
    const result = await sendBatchNotifications(reminder._id, batch.students, finalMessage, {
      soundUrl: soundUrl || null,
      soundName: soundName || 'Default',
      ...notificationSettings
    });

    // Update reminder status
    await BatchReminder.findByIdAndUpdate(reminder._id, {
      status: result.success ? 'sent' : 'failed',
      sentAt: new Date(),
      sentCount: result.sentCount,
      failedCount: result.failedCount
    });

    return res.status(200).json({
      success: true,
      message: `Batch reminder sent to ${result.sentCount} students`,
      data: {
        reminderId: reminder._id,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalStudents: batch.students.length
      }
    });
  } catch (error) {
    console.error('Send batch reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Manually trigger a scheduled reminder
export const triggerReminderManually = async (req, res) => {
  try {
    const { id } = req.params;
    
    const reminder = await BatchReminder.findById(id);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Can only trigger scheduled reminders
    if (reminder.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: `Cannot trigger reminder with status: ${reminder.status}`
      });
    }

    // Update status to sending
    await BatchReminder.findByIdAndUpdate(id, { status: 'sending' });

    // Get batch students
    const batch = await Batch.findById(reminder.batchId)
      .populate('students', 'studentName mobile email');
      
    if (!batch || !batch.students || batch.students.length === 0) {
      await BatchReminder.findByIdAndUpdate(id, { 
        status: 'failed',
        failedCount: 1
      });
      return res.status(400).json({
        success: false,
        message: 'No students found in this batch'
      });
    }

    // Send notifications
    const result = await sendBatchNotifications(
      reminder._id, 
      batch.students, 
      reminder.message,
      reminder.notificationSettings
    );

    // Update reminder status
    await BatchReminder.findByIdAndUpdate(id, {
      status: result.success ? 'sent' : 'failed',
      sentAt: new Date(),
      sentCount: result.sentCount,
      failedCount: result.failedCount
    });

    console.log(`🔥 Manual trigger: Reminder ${id} sent to ${result.sentCount} students`);

    return res.status(200).json({
      success: true,
      message: `Reminder triggered successfully! Sent to ${result.sentCount} students`,
      data: {
        reminderId: id,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        totalStudents: batch.students.length,
        triggeredAt: new Date()
      }
    });
  } catch (error) {
    console.error('Manual trigger reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get all batch reminders
export const getBatchReminders = async (req, res) => {
  try {
    const { page = 1, limit = 10, batchId, status, reminderType } = req.query;
    
    const filter = {};
    if (batchId) filter.batchId = batchId;
    if (status) filter.status = status;
    if (reminderType) filter.reminderType = reminderType;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const reminders = await BatchReminder.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await BatchReminder.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: reminders,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get batch reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Delete batch reminder
export const deleteBatchReminder = async (req, res) => {
  try {
    const { id } = req.params;
    
    const reminder = await BatchReminder.findById(id);
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: 'Reminder not found'
      });
    }

    // Can only delete if not sent yet
    if (reminder.status === 'sent') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete already sent reminder'
      });
    }

    await BatchReminder.findByIdAndUpdate(id, { status: 'cancelled' });

    return res.status(200).json({
      success: true,
      message: 'Reminder cancelled successfully'
    });
  } catch (error) {
    console.error('Delete batch reminder error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Process scheduled reminders (to be called by cron job)
export const processScheduledReminders = async () => {
  try {
    const now = new Date();
    const scheduledReminders = await BatchReminder.find({
      status: 'scheduled',
      scheduledTime: { $lte: now },
      isActive: true
    });

    console.log(`📅 Processing ${scheduledReminders.length} scheduled batch reminders`);

    for (const reminder of scheduledReminders) {
      try {
        // Update status to sending
        await BatchReminder.findByIdAndUpdate(reminder._id, { status: 'sending' });

        // Get batch students
        const batch = await Batch.findById(reminder.batchId)
          .populate('students', 'studentName mobile email');
          
        if (!batch || !batch.students || batch.students.length === 0) {
          await BatchReminder.findByIdAndUpdate(reminder._id, { 
            status: 'failed',
            failedCount: 1
          });
          continue;
        }

        // Send notifications
        const result = await sendBatchNotifications(
          reminder._id, 
          batch.students, 
          reminder.message,
          reminder.notificationSettings
        );

        // Update reminder status
        await BatchReminder.findByIdAndUpdate(reminder._id, {
          status: result.success ? 'sent' : 'failed',
          sentAt: new Date(),
          sentCount: result.sentCount,
          failedCount: result.failedCount
        });

        console.log(`✅ Batch reminder ${reminder._id} sent to ${result.sentCount} students`);
      } catch (error) {
        console.error(`❌ Failed to process reminder ${reminder._id}:`, error);
        await BatchReminder.findByIdAndUpdate(reminder._id, { 
          status: 'failed',
          failedCount: 1
        });
      }
    }
  } catch (error) {
    console.error('Process scheduled reminders error:', error);
  }
};

// Get batch students for reminder preview
export const getBatchStudentsForReminder = async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batch = await Batch.findById(batchId)
      .populate('students', 'studentName mobile email userid')
      .populate('trainingType', 'name')
      .select('batchName classTime startDate students trainingType');
      
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        batch: {
          id: batch._id,
          batchName: batch.batchName,
          classTime: batch.classTime,
          startDate: batch.startDate,
          trainingType: batch.trainingType?.name
        },
        students: batch.students || [],
        totalStudents: batch.students?.length || 0
      }
    });
  } catch (error) {
    console.error('Get batch students error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Upload custom sound for batch reminders
export const uploadReminderSound = async (req, res) => {
  try {
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a sound file'
      });
    }

    // Validate file type (audio files only)
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a valid audio file (MP3, WAV, OGG)'
      });
    }

    const soundUrl = `/uploads/${file.filename}`;
    
    return res.status(200).json({
      success: true,
      message: 'Sound uploaded successfully',
      data: {
        soundUrl,
        soundName: file.originalname,
        fileSize: file.size
      }
    });
  } catch (error) {
    console.error('Upload reminder sound error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Helper function to send notifications to batch students
async function sendBatchNotifications(reminderId, students, message, settings = {}) {
  let sentCount = 0;
  let failedCount = 0;

  const studentUrl = process.env.NODE_ENV === 'production'
    ? 'https://student.thedigicoders.com'
    : 'http://localhost:5174';

  const notificationPayload = {
    notification: {
      title: '🔔 Batch Reminder - DigiCoders',
      body: message
    },
    data: {
      type: 'batch_reminder',
      reminderId: reminderId.toString(),
      soundUrl: settings.soundUrl || '',
      soundName: settings.soundName || 'Default',
      priority: settings.priority || 'high',
      playSound: settings.playSound !== false ? 'true' : 'false',
      soundVolume: (settings.soundVolume || 80).toString(),
      vibrate: settings.vibrate !== false ? 'true' : 'false'
    },
    android: {
      priority: 'high',
      notification: {
        priority: 'high',
        defaultSound: !settings.soundUrl,
        sound: settings.soundUrl || 'default',
        channelId: 'batch_reminders'
      }
    },
    apns: {
      payload: {
        aps: {
          sound: settings.soundUrl || 'default',
          badge: 1
        }
      }
    },
    webpush: {
      fcm_options: {
        link: studentUrl
      },
      notification: {
        icon: '/img/digicoders.jpeg',
        badge: '/img/digicoders.jpeg',
        click_action: studentUrl
      }
    }
  };

  const invalidTokens = [];

  // Send Firebase notifications
  for (const student of students) {
    try {
      // Get student's FCM tokens
      const fcmTokens = await FcmToken.find({ 
        userId: student._id,
        userType: { $in: ['student', 'Registration'] },
        isActive: true
      }).select('token');

      if (fcmTokens.length > 0) {
        const tokens = fcmTokens.map(t => t.token);
        
        console.log(`Sending batch reminder notification to student ${student.studentName || student._id} (tokens: ${tokens.length})`);
        
        const response = await admin.messaging().sendEachForMulticast({
          tokens,
          ...notificationPayload
        });

        console.log(`FCM Multicast response: successCount=${response.successCount}, failureCount=${response.failureCount}`);

        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            const error = resp.error;
            console.error(`Token failed:`, {
              code: error?.code,
              message: error?.message,
              token: tokens[index].substring(0, 20) + '...'
            });
            
            if (error?.code === 'messaging/registration-token-not-registered' || 
                error?.code === 'messaging/invalid-registration-token') {
              invalidTokens.push(tokens[index]);
            }
          }
        });

        if (response.successCount > 0) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      // Send SMS as backup
      if (student.mobile) {
        try {
          await sendSMS(student.mobile, message);
        } catch (smsError) {
          console.error(`SMS failed for ${student.mobile}:`, smsError);
        }
      }
    } catch (error) {
      console.error(`Notification failed for student ${student._id}:`, error);
      failedCount++;
    }
  }

  // Clean up invalid tokens
  if (invalidTokens.length > 0) {
    try {
      await FcmToken.deleteMany({ token: { $in: invalidTokens } });
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens for batch reminders`);
    } catch (cleanupError) {
      console.error('Error cleaning up invalid tokens:', cleanupError);
    }
  }

  return {
    success: sentCount > 0,
    sentCount,
    failedCount
  };
}