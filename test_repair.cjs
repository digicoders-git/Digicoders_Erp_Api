const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://digicodersErp:digicodersErp@cluster0.j1idc0p.mongodb.net/ERP");
    const db = mongoose.connection.useDb("ERP");
    
    const registrations = await db.collection("registrations").find({}).toArray();
    
    let repairedCount = 0;
    
    for (const r of registrations) {
      // Find all valid fee records (we'll count anything that is "accepted" or has a tnxStatus of "paid" / "full paid")
      // Specifically in ERP logic, "accepted" status implies it's finalized by admin, OR if it's a payment_link it might be "accepted" directly.
      // Wait, let's check feeController.js for what counts as paid.
      // Usually, if a fee has amount > 0 and status is NOT rejected/failed. 
      // In the ERP: status can be "new", "accepted", "rejected".
      // But wait! If it's "new", the student HAS paid it (e.g. handed cash). The admin just hasn't clicked "Accept" yet.
      // In ERP, "new" offline payments DO count towards paidAmount instantly. 
      // Let's count fees where status is IN ["new", "accepted"] AND amount > 0.
      
      const fees = await db.collection("fees").find({ 
        registrationId: r._id,
        status: { $in: ["new", "accepted"] }
      }).toArray();
      
      const truePaidAmount = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
      const finalFee = Number(r.finalFee || 0);
      const trueDueAmount = Math.max(finalFee - truePaidAmount, 0);
      
      const currentPaid = Number(r.paidAmount || 0);
      const currentDue = Number(r.dueAmount || 0);
      
      if (currentPaid !== truePaidAmount || currentDue !== trueDueAmount) {
        // We need to repair it!
        let newTrainingFeeStatus = "pending";
        if (truePaidAmount >= finalFee) newTrainingFeeStatus = "full paid";
        else if (truePaidAmount > 0) newTrainingFeeStatus = "partial";
        
        let newTnxStatus = "pending";
        if (truePaidAmount >= finalFee) newTnxStatus = "full paid";
        else if (truePaidAmount > 0) newTnxStatus = "paid";

        await db.collection("registrations").updateOne(
          { _id: r._id },
          { 
            $set: { 
              paidAmount: truePaidAmount,
              dueAmount: trueDueAmount,
              trainingFeeStatus: newTrainingFeeStatus,
              tnxStatus: newTnxStatus
            }
          }
        );
        repairedCount++;
      }
    }
    
    console.log(`Repaired ${repairedCount} student records.`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
