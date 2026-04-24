import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Education from "../models/education.js";

await mongoose.connect(process.env.MONGODB_URI);
console.log("DB connected");

const educations = [
  "B.Tech (CS)",
  "B.Tech (IT)",
  "B.Tech (Electrical)",
  "B.Tech (Electronics)",
  "B.Tech (EC)",
  "Diploma (CS)",
  "Diploma (IT)",
  "Diploma (ECE)",
  "Diploma (EE)",
  "Diploma (Electronics)",
  "Diploma (Civil)",
  "Diploma (Mechanical)",
  "Diploma (Automobile)",
  "Diploma (Biotechnology)",
  "Diploma (PGDCA)",
  "Diploma (PG Web Designing)",
  "BCA",
  "MCA",
  "M.Tech (CS)",
  "M.Tech (IT)",
  "Other",
];

for (const name of educations) {
  await Education.create({ name });
  console.log("✅ Added: " + name);
}

console.log("\nTotal inserted:", educations.length);
await mongoose.disconnect();
