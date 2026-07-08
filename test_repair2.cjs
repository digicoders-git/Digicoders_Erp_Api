const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://digicodersErp:digicodersErp@cluster0.j1idc0p.mongodb.net/ERP");
    const db = mongoose.connection.useDb("ERP");
    
    // Use aggregation to group valid fees by registrationId
    const feesByReg = await db.collection("fees").aggregate([
      { $match: { status: { $in: ["new", "accepted"] } } },
      { $group: { _id: "$registrationId", totalPaid: { $sum: { $toDouble: "$amount" } } } }
    ]).toArray();
    
    const paidMap = {};
    for (const f of feesByReg) {
      if (f._id) paidMap[f._id.toString()] = f.totalPaid;
    }

    const registrations = await db.collection("registrations").find({}).toArray();
    let repairedCount = 0;

    // Use bulk write for speed
    const bulkOps = [];
    
    for (const r of registrations) {
      const truePaidAmount = paidMap[r._id.toString()] || 0;
      const finalFee = Number(r.finalFee || 0);
      const trueDueAmount = Math.max(finalFee - truePaidAmount, 0);
      
      const currentPaid = Number(r.paidAmount || 0);
      const currentDue = Number(r.dueAmount || 0);
      
      if (currentPaid !== truePaidAmount || currentDue !== trueDueAmount) {
        let newTrainingFeeStatus = "pending";
        if (truePaidAmount >= finalFee) newTrainingFeeStatus = "full paid";
        else if (truePaidAmount > 0) newTrainingFeeStatus = "partial";
        
        let newTnxStatus = "pending";
        if (truePaidAmount >= finalFee) newTnxStatus = "full paid";
        else if (truePaidAmount > 0) newTnxStatus = "paid";

        bulkOps.push({
          updateOne: {
            filter: { _id: r._id },
            update: { 
              $set: { 
                paidAmount: truePaidAmount,
                dueAmount: trueDueAmount,
                trainingFeeStatus: newTrainingFeeStatus,
                tnxStatus: newTnxStatus
              }
            }
          }
        });
        repairedCount++;
      }
    }
    
    if (bulkOps.length > 0) {
      await db.collection("registrations").bulkWrite(bulkOps);
    }
    console.log(`Repaired ${repairedCount} student records efficiently!`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
