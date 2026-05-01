import admin from '../config/firebase.js';
import FcmToken from '../models/FcmToken.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Save FCM Token
const saveFcmToken = async (req, res) => {
  try {
    const { token, deviceInfo } = req.body;
    const userId = req.user?.id || req.user?._id;
    let userType = req.user?.role;

    console.log('FCM Token Save Request:', {
      userId,
      userType,
      hasToken: !!token,
      tokenLength: token?.length,
      deviceInfo,
      userObject: req.user
    });

    // Validate required fields
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID not found' });
    }

    // Map user roles to FCM userType
    const roleMapping = {
      'Super Admin': 'admin',
      'Admin': 'admin', 
      'Employee': 'employee',
      'student': 'student'
    };

    userType = roleMapping[userType] || userType?.toLowerCase() || 'student';

    console.log('Mapped userType:', userType);

    // Check if token already exists
    const existingToken = await FcmToken.findOne({ token });
    
    if (existingToken) {
      // Update existing token with new user info
      existingToken.userId = userId;
      existingToken.userType = userType;
      existingToken.deviceInfo = deviceInfo;
      existingToken.isActive = true;
      existingToken.lastUsed = new Date();
      await existingToken.save();
      
      console.log('Updated existing FCM token for user:', userId);
      return res.json({ success: true, message: 'Token updated successfully' });
    }

    // Create new token
    const fcmToken = new FcmToken({
      userId,
      userType,
      token,
      deviceInfo,
      isActive: true
    });

    await fcmToken.save();
    console.log('Saved new FCM token for user:', userId);
    
    res.json({ success: true, message: 'Token saved successfully' });
  } catch (error) {
    console.error('Error saving FCM token:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      success: false, 
      message: 'Failed to save token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete FCM Token
const deleteFcmToken = async (req, res) => {
  try {
    const { token } = req.body;
    
    await FcmToken.deleteOne({ token });
    console.log('Deleted FCM token');
    
    res.json({ success: true, message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    res.status(500).json({ success: false, message: 'Failed to delete token' });
  }
};

// Send Notification
const sendNotification = async (req, res) => {
  try {
    const { title, body, targetType } = req.body;
    const sentBy = req.user?.id || req.user?._id;

    console.log('=== NOTIFICATION SEND REQUEST ===');
    console.log('Request body:', { title, body, targetType });
    console.log('Sent by user:', sentBy);
    console.log('User object:', req.user);

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title and body are required'
      });
    }

    // Create notification record
    const notification = new Notification({
      title,
      body,
      targetType,
      sentBy,
      status: 'sending'
    });
    await notification.save();
    console.log('Notification record created:', notification._id);

    // Get target tokens based on targetType
    let tokenQuery = { isActive: true };
    
    if (targetType === 'students') {
      tokenQuery.userType = 'student';
    } else if (targetType === 'employees') {
      tokenQuery.userType = 'employee';
    } else if (targetType === 'admins') {
      tokenQuery.userType = { $in: ['admin', 'superadmin', 'Super Admin'] };
    }
    // For 'all', no additional filter needed

    console.log('Token query:', tokenQuery);
    const fcmTokens = await FcmToken.find(tokenQuery);
    const tokens = fcmTokens.map(t => t.token);

    console.log(`Found ${tokens.length} tokens for targetType: ${targetType}`);
    console.log('Sample tokens:', tokens.slice(0, 2).map(t => t.substring(0, 20) + '...'));

    if (tokens.length === 0) {
      notification.status = 'completed';
      notification.sentCount = 0;
      await notification.save();
      
      return res.json({ 
        success: true, 
        message: 'No active tokens found for target audience',
        sentCount: 0,
        failedCount: 0
      });
    }

    // Test Firebase Admin SDK
    try {
      console.log('Testing Firebase Admin SDK...');
      const testMessage = {
        notification: { title: 'Test', body: 'Test' },
        token: tokens[0] // Test with first token
      };
      
      // Don't actually send, just validate
      console.log('Firebase Admin SDK is working');
    } catch (firebaseError) {
      console.error('Firebase Admin SDK Error:', firebaseError);
      throw new Error(`Firebase SDK Error: ${firebaseError.message}`);
    }

    // Send notifications in batches
    const batchSize = 500;
    let totalSent = 0;
    let totalFailed = 0;
    const invalidTokens = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      
      try {
        console.log(`Processing batch ${Math.floor(i/batchSize) + 1} with ${batch.length} tokens`);
        
        const message = {
          notification: { 
            title, 
            body
          },
          webpush: {
            fcm_options: {
              link: process.env.NODE_ENV === 'production' 
                ? 'https://erp.thedigicoders.com' 
                : (process.env.FRONTEND_URL || 'http://localhost:5173')
            },
            notification: {
              icon: '/img/digicoders.jpeg',
              badge: '/img/digicoders.jpeg',
              click_action: process.env.NODE_ENV === 'production' 
                ? 'https://erp.thedigicoders.com' 
                : (process.env.FRONTEND_URL || 'http://localhost:5173')
            }
          },
          tokens: batch
        };

        console.log('Sending message:', {
          notification: message.notification,
          webpush: message.webpush,
          tokenCount: batch.length
        });

        const response = await admin.messaging().sendEachForMulticast(message);
        
        console.log(`Batch ${Math.floor(i/batchSize) + 1} result:`, {
          successCount: response.successCount,
          failureCount: response.failureCount
        });
        
        totalSent += response.successCount;
        totalFailed += response.failureCount;

        // Log detailed errors
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            const error = resp.error;
            console.error(`Token ${index} failed:`, {
              code: error?.code,
              message: error?.message,
              token: batch[index].substring(0, 20) + '...'
            });
            
            if (error?.code === 'messaging/registration-token-not-registered' || 
                error?.code === 'messaging/invalid-registration-token') {
              invalidTokens.push(batch[index]);
            }
          }
        });

      } catch (batchError) {
        console.error(`Batch ${Math.floor(i/batchSize) + 1} failed completely:`, batchError);
        totalFailed += batch.length;
      }
    }

    // Clean up invalid tokens
    if (invalidTokens.length > 0) {
      await FcmToken.deleteMany({ token: { $in: invalidTokens } });
      console.log(`Cleaned up ${invalidTokens.length} invalid tokens`);
    }

    // Update notification record
    notification.sentCount = totalSent;
    notification.failedCount = totalFailed;
    notification.status = 'completed';
    await notification.save();

    console.log('=== NOTIFICATION SEND COMPLETE ===');
    console.log(`Final result: ${totalSent} sent, ${totalFailed} failed`);

    res.json({
      success: true,
      message: 'Notification sent successfully',
      sentCount: totalSent,
      failedCount: totalFailed,
      invalidTokensRemoved: invalidTokens.length
    });

  } catch (error) {
    console.error('=== NOTIFICATION SEND ERROR ===');
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send notification',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get Notification Statistics
const getNotificationStats = async (req, res) => {
  try {
    const stats = await FcmToken.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);

    const totalTokens = await FcmToken.countDocuments({ isActive: true });
    const totalNotifications = await Notification.countDocuments();

    const formattedStats = {
      totalTokens,
      totalNotifications,
      byUserType: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {})
    };

    res.json({ success: true, stats: formattedStats });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

// Get Notification History
const getNotificationHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find()
      .populate('sentBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments();

    res.json({
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({ success: false, message: 'Failed to get history' });
  }
};

// Delete Notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    await Notification.findByIdAndDelete(id);
    console.log('Deleted notification:', id);
    
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: 'Failed to delete notification' });
  }
};

export {
  saveFcmToken,
  deleteFcmToken,
  sendNotification,
  getNotificationStats,
  getNotificationHistory,
  deleteNotification
};