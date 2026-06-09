import cron from 'node-cron';
import { processScheduledReminders } from '../controllers/batchReminderController.js';

// Run every minute to check for scheduled batch reminders
const scheduleBatchReminders = () => {
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledReminders();
    } catch (error) {
      console.error('⚠️ Batch reminder cron job error:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log('📅 Batch reminder cron job scheduled (every minute)');
};

export { scheduleBatchReminders };