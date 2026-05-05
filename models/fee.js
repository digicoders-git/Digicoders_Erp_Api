
import mongoose from "mongoose";

const feeSchema = new mongoose.Schema(
    {
        registrationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Registration",
            required: true,
        },
        totalFee: { type: Number, required: true }, // Set during registration
        discount: { type: Number },
        finalFee: { type: Number, required: true },
        paidAmount: { type: Number, default: 0 },
        dueAmount: { type: Number, default: 0 },
        amount: {
            type: Number,
            required: true,
        },
        paymentType: {
            type: String,
            enum: ["registration", "installment", "full"],
            required: true,
        },
        mode: {
            type: String,
            enum: ["cash", "upi_qr", "pos", "payment_link", "emi", "online"],
        },
        qrcode: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "QrCode",
            default: null,
            sparse: true,
        },
        hrName: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Hr",
        },
        tnxId: {
            type: String,
            unique: true,
            sparse: true,
            required: function () {
                return ["upi_qr", "pos", "payment_link"].includes(this.mode);
            },
        },
        status: {
            type: String,
            enum: ["accepted", "rejected", "new"],
            default: "new",
        },
        tnxStatus: {
            type: String,
            enum: ["pending", "paid", "failed", "full paid"],
            default: "pending",
        },
        installmentNo: {
            type: Number,
            default: 0,
        },
        receiptNo: {
            type: String,
            unique: true,
        },
        paymentDate: {
            type: Date,
            default: Date.now,
        },
        isFullPaid: {
            type: Boolean,
            default: false,
        },
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        image: {
            url: { type: String },
            public_id: { type: String },
        },
        remark: {
            type: String,
            default: "",
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "success", "failed"],
            default: "pending",
        },
        paymentLink: {
            type: String,
            default: null,
        },
    },
    { timestamps: true }
);
// Auto-generate receiptNo
// feeSchema.pre("save", function (next) {
//   if (!this.receiptNo) {
//     this.receiptNo = `DCTREC-${new Date().getFullYear()}-${Math.floor(
//       100 + Math.random() * 900
//     )}`;
//   }
//   next();
// });
feeSchema.pre("save", async function (next) {
    if (this.receiptNo) return next();

    const year = new Date().getFullYear();

    // 🔍 Find the last receipt for this year
    const lastFee = await this.constructor
        .findOne({ receiptNo: new RegExp(`^DCTREC-${year}-`) })
        .sort({ createdAt: -1 })
        .select("receiptNo");

    let nextNumber = 1;

    if (lastFee?.receiptNo) {
        const receiptParts = lastFee.receiptNo.split("-");
        if (receiptParts.length === 3) {
            const lastNumber = parseInt(receiptParts[2]);
            if (!isNaN(lastNumber)) {
                nextNumber = lastNumber + 1;
            }
        }
    }

    // 000001 format (6 digit)
    const serial = String(nextNumber).padStart(6, "0");

    this.receiptNo = `DCTREC-${year}-${serial}`;

    next();
});

const Fee = mongoose.model("Fee", feeSchema);
export default Fee;
