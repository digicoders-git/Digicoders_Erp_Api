import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Registration from "./models/regsitration.js";

mongoose.connect(process.env.DB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const students = await Registration.find({});
    
    let badRecords = 0;
    let totalDiscrepancy = 0;
    
    students.forEach(s => {
      const finalFee = Number(s.finalFee || 0);
      const paid = Number(s.paidAmount || 0);
      const due = Number(s.dueAmount || 0);
      
      if (Math.abs((paid + due) - finalFee) > 10) {
        badRecords++;
        totalDiscrepancy += Math.abs((paid + due) - finalFee);
      }
    });
    
    console.log(`Found ${badRecords} student records with bad math.`);
    console.log(`Total discrepancy amount in DB: ${totalDiscrepancy}`);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
