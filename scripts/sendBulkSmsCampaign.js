import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

// Load env
dotenv.config();

const AUTH_KEY = process.env.SMS_API_AUTHKEY || '370038Amo3cZx0h696a3f7dP1';
const SENDER_ID = process.env.SENDER_ID || 'DIGICO';
const DLT_TE_ID = '1707178185852877297';
const MESSAGE = 'DigiCoders Summer Training: Last Batch registration closing soon! Last Batch: 22 June. Call/WhatsApp 9198483820 for details & registration. Online/Offline Mode';

const logFile = path.resolve('../scratch/bulk_sms_campaign_june22.log');

function log(msg) {
  const time = new Date().toLocaleString();
  const logMsg = `[${time}] ${msg}\n`;
  console.log(logMsg.trim());
  try {
    fs.appendFileSync(logFile, logMsg);
  } catch (err) {
    console.error('Error writing to log file:', err.message);
  }
}

async function runCampaign() {
  log('Starting bulk SMS campaign...');
  
  // Read numbers from scratch/numbers.json
  const numbersPath = path.resolve('../scratch/numbers.json');
  if (!fs.existsSync(numbersPath)) {
    log(`Error: numbers.json not found at ${numbersPath}`);
    process.exit(1);
  }
  
  const rawNumbers = JSON.parse(fs.readFileSync(numbersPath, 'utf8'));
  // Filter out invalid/empty numbers, clean them to be exactly 10 digits
  const numbers = rawNumbers
    .map(num => num.toString().trim().replace(/\D/g, ''))
    .filter(num => num.length === 10);
    
  log(`Loaded ${rawNumbers.length} raw numbers. Valid 10-digit numbers to process: ${numbers.length}`);
  
  const BATCH_SIZE = 100;
  let successCount = 0;
  let failedCount = 0;
  
  for (let i = 0; i < numbers.length; i += BATCH_SIZE) {
    const batch = numbers.slice(i, i + BATCH_SIZE);
    // Prefix 91 to each number and join with commas
    const mobilesStr = batch.map(num => `91${num}`).join(',');
    
    log(`Sending batch [${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(numbers.length / BATCH_SIZE)}] (${batch.length} numbers)...`);
    
    const url = 'http://sms.digicoders.in/api/sendhttp.php';
    const params = {
      authkey: AUTH_KEY,
      mobiles: mobilesStr,
      message: MESSAGE,
      sender: SENDER_ID,
      route: 4,
      country: 91,
      DLT_TE_ID: DLT_TE_ID
    };
    
    try {
      const response = await axios.get(url, { params, timeout: 15000 });
      log(`[SUCCESS] Batch sent. Response: ${JSON.stringify(response.data)}`);
      successCount += batch.length;
    } catch (error) {
      log(`[ERROR] Batch failed: ${error.message}`);
      failedCount += batch.length;
    }
    
    // Sleep for 300ms to be polite to the SMS gateway
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  log(`Campaign Finished! Success: ${successCount}, Failed: ${failedCount}, Total: ${numbers.length}`);
}

runCampaign().catch(error => {
  log(`Critical error: ${error.message}`);
  process.exit(1);
});
