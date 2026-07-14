import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: '/Users/kiran_maddheshiya/Downloads/Erp Latest Last/ERP/erpapi.thedigicoders.com/.env' });

const feeSchema = new mongoose.Schema({
    mode: String,
    amount: Number,
    paymentStatus: String,
    status: String,
    paymentDate: Date,
    createdAt: Date,
}, { strict: false });

const Fee = mongoose.model("Fee", feeSchema);

async function checkCollections() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Let's get start and end of today in local time
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        console.log("Checking collections between", startOfToday, "and", endOfToday);

        const fees = await Fee.find({
            createdAt: { $gte: startOfToday, $lte: endOfToday }
        });

        let totalAmount = 0;
        let cashAmount = 0;
        let otherModes = {};

        fees.forEach(f => {
            const amt = f.amount || 0;
            totalAmount += amt;
            if (f.mode === 'cash') {
                cashAmount += amt;
            } else {
                otherModes[f.mode] = (otherModes[f.mode] || 0) + amt;
            }
        });

        console.log(`\n======================================`);
        console.log(`Total Receipts Today: ${fees.length}`);
        console.log(`Total Fees Payment Today: ₹${totalAmount}`);
        console.log(`Total Cash Collection Today: ₹${cashAmount}`);
        console.log(`Other Modes Collection:`, otherModes);
        console.log(`======================================\n`);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await mongoose.disconnect();
    }
}

checkCollections();
