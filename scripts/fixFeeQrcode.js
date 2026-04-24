// scripts/fixFeeQrcode.js
// यह script फी collection में existing null qrcode values को remove करता है

import mongoose from "mongoose";
import Fee from "../models/fee.js";

async function fixFeeQrcode() {
  try {
    // Get MONGO_URI from environment or use default
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/digicoders";
    
    console.log("Connecting to:", mongoUri);
    
    // Connect to MongoDB
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    // Update all Fee records where qrcode is null or empty string
    const result = await Fee.updateMany(
      {
        $or: [
          { qrcode: null },
          { qrcode: "" },
          { qrcode: "null" },
        ]
      },
      {
        $unset: { qrcode: 1 }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} records`);

    // Also drop existing index if any
    try {
      await Fee.collection.dropIndex("qrcode_1");
      console.log("✅ Dropped old qrcode index");
    } catch (err) {
      // Index might not exist
      console.log("ℹ️  No old index to drop");
    }

    // Create new sparse index
    await Fee.collection.createIndex({ qrcode: 1 }, { sparse: true });
    console.log("✅ Created new sparse index for qrcode");

    console.log("\n✅ Migration completed successfully!");
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
}

fixFeeQrcode();
