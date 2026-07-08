const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://digicodersErp:digicodersErp@cluster0.j1idc0p.mongodb.net/ERP");
    const db = mongoose.connection.useDb("ERP");
    
    // We don't even need the model, we can just use native driver collection
    const registrations = await db.collection("registrations").find({}).toArray();
    
    let mismatchCount = 0;
    let totalMismatch = 0;
    const examples = [];
    
    registrations.forEach(r => {
      const finalFee = Number(r.finalFee || 0);
      const paid = Number(r.paidAmount || 0);
      const due = Number(r.dueAmount || 0);
      
      if (Math.abs((paid + due) - finalFee) > 0) {
        mismatchCount++;
        totalMismatch += ((paid + due) - finalFee);
        if (examples.length < 5) {
          examples.push({
            name: r.studentName,
            id: r.userid,
            finalFee,
            paid,
            due,
            discrepancy: (paid + due) - finalFee
          });
        }
      }
    });
    
    console.log(`Found ${mismatchCount} records where Paid + Due != Final Fee`);
    console.log(`Total Extra in (Paid + Due): ₹${totalMismatch}`);
    console.log("Examples of corrupted records:");
    console.table(examples);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
