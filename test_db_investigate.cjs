const mongoose = require("mongoose");

(async () => {
  try {
    await mongoose.connect("mongodb+srv://digicodersErp:digicodersErp@cluster0.j1idc0p.mongodb.net/ERP");
    const db = mongoose.connection.useDb("ERP");
    
    // Find Priya's registration
    const student = await db.collection("registrations").findOne({ userid: "DCT-2026-0074" });
    console.log("=== REGISTRATION RECORD ===");
    console.log(student);

    if (student) {
      // Find all her fee transactions
      const fees = await db.collection("fees").find({ registrationId: student._id }).toArray();
      console.log("\n=== FEE TRANSACTIONS ===");
      console.log(fees);
    }
    
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();
