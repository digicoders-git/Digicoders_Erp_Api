const mongoose = require("mongoose");
const Registration = require("./models/regsitration.js").default || require("./models/regsitration.js");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://digicodersErp:digicodersErp@cluster0.j1idc0p.mongodb.net/ERP");
    const db = mongoose.connection.useDb("ERP");
    const registrations = await db.collection("registrations").find({}).toArray();
    
    let fixed = 0;
    for (const r of registrations) {
      const paid = Number(r.paidAmount || 0);
      const finalFee = Number(r.finalFee || 0);
      const totalFee = Number(r.totalFee || 0);
      
      if (paid > finalFee) {
        // Fix by adjusting discount and finalFee
        const newFinalFee = paid; // Raise finalFee to match what was paid
        const newDiscount = Math.max(totalFee - newFinalFee, 0); // Recalculate discount
        
        await db.collection("registrations").updateOne(
          { _id: r._id },
          { $set: { finalFee: newFinalFee, discount: newDiscount, dueAmount: 0 } }
        );
        console.log(`Fixed student ${r.userid}. Old FinalFee: ${finalFee}, New FinalFee: ${newFinalFee}`);
        fixed++;
      }
    }
    console.log(`Fixed ${fixed} overpaid students.`);
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
