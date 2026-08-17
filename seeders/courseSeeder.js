import mongoose from "mongoose";
import dotenv from "dotenv";
import Duration from "../models/durationModel.js";
import TranningModal from "../models/tranning.js";
import TechnologyModal from "../models/technology.js";

dotenv.config();

const seedCourses = async () => {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Database connected successfully!");

    // 1. Create Durations
    let durationFoundation = await Duration.findOne({ name: "Foundation Course" });
    if (!durationFoundation) {
      durationFoundation = await Duration.create({ name: "Foundation Course" });
      console.log("Created duration 'Foundation Course'");
    }

    let durationApprenticeship = await Duration.findOne({ name: "Online Apprenticeship" });
    if (!durationApprenticeship) {
      durationApprenticeship = await Duration.create({ name: "Online Apprenticeship" });
      console.log("Created duration 'Online Apprenticeship'");
    }

    // 2. Create Training Programs
    let trainFoundation = await TranningModal.findOne({ name: "Foundation Course [Pre-Final Year]" });
    if (!trainFoundation) {
      trainFoundation = await TranningModal.create({
        name: "Foundation Course [Pre-Final Year]",
        duration: durationFoundation._id,
        registrationAmount: 500,
      });
      console.log("Created Training 'Foundation Course [Pre-Final Year]'");
    } else {
      trainFoundation.duration = durationFoundation._id;
      await trainFoundation.save();
      console.log("Updated Training 'Foundation Course [Pre-Final Year]'");
    }

    let trainApprenticeship = await TranningModal.findOne({ name: "Online Apprenticeship [Final Year]" });
    if (!trainApprenticeship) {
      trainApprenticeship = await TranningModal.create({
        name: "Online Apprenticeship [Final Year]",
        duration: durationApprenticeship._id,
        registrationAmount: 500,
      });
      console.log("Created Training 'Online Apprenticeship [Final Year]'");
    } else {
      trainApprenticeship.duration = durationApprenticeship._id;
      await trainApprenticeship.save();
      console.log("Updated Training 'Online Apprenticeship [Final Year]'");
    }

    // 3. Create technologies for Foundation Course (Price: 999)
    const techNames = [
      "Python", "MERN Stack", "Java", "Android", "Web Development", "PHP", "App Development", "Software Testing"
    ];

    for (const name of techNames) {
      let existingTech = await TechnologyModal.findOne({ name, duration: durationFoundation._id });
      if (!existingTech) {
        await TechnologyModal.create({
          name,
          price: 999,
          duration: durationFoundation._id,
          isActive: true
        });
        console.log(`Created Foundation technology '${name}' with price 999`);
      } else {
        existingTech.price = 999;
        await existingTech.save();
        console.log(`Updated Foundation technology '${name}' price to 999`);
      }
    }

    // 4. Create technologies for Online Apprenticeship (Price: 1499)
    for (const name of techNames) {
      let existingTech = await TechnologyModal.findOne({ name, duration: durationApprenticeship._id });
      if (!existingTech) {
        await TechnologyModal.create({
          name,
          price: 1499,
          duration: durationApprenticeship._id,
          isActive: true
        });
        console.log(`Created Apprenticeship technology '${name}' with price 1499`);
      } else {
        existingTech.price = 1499;
        await existingTech.save();
        console.log(`Updated Apprenticeship technology '${name}' price to 1499`);
      }
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedCourses();
