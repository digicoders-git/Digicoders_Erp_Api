const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://digicodersErp:digicodersErp@cluster0.j1idc0p.mongodb.net/ERP");
    const db = mongoose.connection.useDb("ERP");
    
    const registrations = await db.collection("registrations").find({}).toArray();
    let overpaidCount = 0;
    let totalOverpaid = 0;
    
    for (const r of registrations) {
      const paid = Number(r.paidAmount || 0);
      const finalFee = Number(r.finalFee || 0);
      
      if (paid > finalFee) {
        overpaidCount++;
        const excess = paid - finalFee;
        totalOverpaid += excess;
        console.log(`Student ${r.studentName} (${r.userid}) paid ₹${paid} but final fee is ₹${finalFee}. Excess: ₹${excess}`);
      }
    }
    
    console.log(`Found ${overpaidCount} overpaid students. Total excess: ₹${totalOverpaid}`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
