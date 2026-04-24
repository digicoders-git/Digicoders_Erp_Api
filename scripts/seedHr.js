import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Hr from "../models/manageHr.js";

await mongoose.connect(process.env.MONGODB_URI);
console.log("DB connected");

const hrs = [
  { name: "Gayatri Ma'am", personalNo: "9236065006" },
  { name: "Divya Ma'am",   personalNo: "8004615998" },
  { name: "Reetu Ma'am",   personalNo: "9369673808" },
  { name: "Richa Ma'am",   personalNo: "9250945491" },
  { name: "Jyoti Ma'am",   personalNo: "9219386048" },
  { name: "Soni Ma'am",    personalNo: "6389187569" },
  { name: "Shrishti Ma'am",personalNo: "9336104434" },
  { name: "Muskan Ma'am",  personalNo: "7317408523" },
  { name: "Kriti Malviya", personalNo: "7376919039" },
  { name: "Deepa",         personalNo: "9927457529" },
  { name: "Shivani",       personalNo: "6307275065" },
  { name: "Kamini",        personalNo: "7307272820" },
  { name: "Preeti Yadav",  personalNo: "6391958626" },
];

for (const hr of hrs) {
  await Hr.create(hr);
  console.log("✅ Added: " + hr.name + " (" + hr.personalNo + ")");
}

console.log("\nTotal inserted:", hrs.length);
await mongoose.disconnect();
