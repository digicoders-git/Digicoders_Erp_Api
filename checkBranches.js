import mongoose from "mongoose";
import Registration from "./models/regsitration.js";
import Branch from "./models/branch.js";
import dotenv from "dotenv";

dotenv.config();

const phones = [
  "9118585378",
  "7238039051",
  "9565225041",
  "8423133276",
  "7380566234",
  "9984575355",
  "9336180590",
  "8423271602",
  "7897936895",
  "7991638474",
  "8948692812",
  "9236901077",
  "9005223816",
  "6393918940",
  "8933923733",
  "9450745898",
  "7007656630",
  "8400016711",
  "9450200146"
];

async function checkBranches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    const students = await Registration.find({ mobile: { $in: phones } }).populate("branch", "name");

    console.log(`Found ${students.length} students matching the phone numbers.`);
    console.log("--------------------------------------------------");
    
    students.forEach(s => {
      console.log(`Name: ${s.studentName} | Phone: ${s.mobile} | Branch: ${s.branch ? s.branch.name : 'Not Assigned'}`);
    });
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

checkBranches();
