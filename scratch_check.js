import mongoose from "mongoose";
import dotenv from "dotenv";
import Registration from "./models/regsitration.js";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log("Connected to MongoDB");
  
  const queryFiltered = await Registration.find({ 
    $or: [{ userid: { $regex: "96965", $options: "i" } }, { studentName: { $regex: "96965", $options: "i" } }, { mobile: { $regex: "96965", $options: "i" } }],
    certificateIssued: { $ne: true } 
  });
  console.log("Search '96965' with $ne: true returned count:", queryFiltered.length);
  console.log("Results:", queryFiltered.map(u => u.studentName + " - cert:" + u.certificateIssued));
  
  process.exit(0);
});
