import mongoose from 'mongoose';
import Fee from '../models/fee.js';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const fee = await Fee.findById('6a797e1e9e07b64358386539');
    console.log(JSON.stringify(fee, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
