import mongoose from "mongoose";
import TechnologyModal from "../models/technology.js";
import dotenv from "dotenv";

dotenv.config();

const removeDuplicates = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const technologies = await TechnologyModal.find({});
    const seen = new Map();
    const toDelete = [];

    technologies.forEach((tech) => {
      const key = `${tech.name.trim().toUpperCase()}_${tech.duration}`;
      if (seen.has(key)) {
        toDelete.push(tech._id);
      } else {
        seen.set(key, tech._id);
      }
    });

    if (toDelete.length > 0) {
      const res = await TechnologyModal.deleteMany({ _id: { $in: toDelete } });
      console.log(`Deleted ${res.deletedCount} duplicate technologies.`);
    } else {
      console.log("No duplicates found.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error removing duplicates:", error);
    process.exit(1);
  }
};

removeDuplicates();
