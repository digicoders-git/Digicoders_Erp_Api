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

async function updateBranches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB...");

    // Find the Gorakhpur Gida branch ID
    const gorakhpurBranch = await Branch.findOne({ name: { $regex: /Gorakhpur.*Gida/i } });
    if (!gorakhpurBranch) {
      console.log("Gorakhpur Gida branch not found!");
      return;
    }
    console.log(`Found target branch: ${gorakhpurBranch.name} (ID: ${gorakhpurBranch._id})`);

    const students = await Registration.find({ mobile: { $in: phones } }).populate("branch", "name");

    console.log(`Updating students...`);
    let updatedCount = 0;
    
    for (const s of students) {
      const currentBranch = s.branch ? s.branch.name : '';
      if (currentBranch.includes("Lucknow") || currentBranch.includes("Online")) {
        console.log(`Updating ${s.studentName} (${s.mobile}) from '${currentBranch}' to '${gorakhpurBranch.name}'`);
        s.branch = gorakhpurBranch._id;
        await s.save();
        updatedCount++;
      } else {
        console.log(`Skipping ${s.studentName} (${s.mobile}) - Current branch: '${currentBranch}'`);
      }
    }
    
    console.log(`Successfully updated ${updatedCount} students.`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

updateBranches();
