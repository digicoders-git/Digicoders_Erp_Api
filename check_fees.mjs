import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const feeSchema = new mongoose.Schema({ paidBy: mongoose.Schema.Types.ObjectId, paymentMode: String, mode: String });
const Fee = mongoose.model('Fee', feeSchema);

const userSchema = new mongoose.Schema({ name: String });
const User = mongoose.model('User', userSchema);

async function check() {
  await mongoose.connect(process.env.MONGO_URL);
  
  const fees = await Fee.find().limit(50);
  let studentCount = 0;
  let adminCount = 0;
  let nullCount = 0;
  
  for (let f of fees) {
    if (!f.paidBy) {
      nullCount++;
    } else {
      const u = await User.findById(f.paidBy);
      if (u) adminCount++;
      else studentCount++;
    }
  }
  
  console.log(`Total checked: ${fees.length}`);
  console.log(`Null paidBy: ${nullCount}`);
  console.log(`Admin paidBy (valid User): ${adminCount}`);
  console.log(`Student paidBy (invalid User): ${studentCount}`);
  process.exit(0);
}

check();
