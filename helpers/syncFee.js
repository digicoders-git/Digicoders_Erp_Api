import Registration from "../models/regsitration.js";
import Fee from "../models/fee.js";

export const syncRegistrationFees = async (registrationId) => {
  try {
    // Find all valid fee receipts (new or accepted)
    const validFees = await Fee.find({
      registrationId,
      status: { $in: ["new", "accepted"] }
    });

    const totalPaidAmount = validFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const registration = await Registration.findById(registrationId);
    if (!registration) return;

    let finalFee = Number(registration.finalFee || 0);
    if (totalPaidAmount > finalFee) {
      finalFee = totalPaidAmount;
    }

    const totalDueAmount = Math.max(finalFee - totalPaidAmount, 0);

    let newTrainingFeeStatus = "pending";
    if (totalPaidAmount >= finalFee && finalFee > 0) newTrainingFeeStatus = "full paid";
    else if (totalPaidAmount > 0) newTrainingFeeStatus = "partial";

    let newTnxStatus = "pending";
    if (totalPaidAmount >= finalFee && finalFee > 0) newTnxStatus = "full paid";
    else if (totalPaidAmount > 0) newTnxStatus = "paid";

    registration.finalFee = finalFee;
    registration.paidAmount = totalPaidAmount;
    registration.dueAmount = totalDueAmount;
    registration.trainingFeeStatus = newTrainingFeeStatus;
    registration.tnxStatus = newTnxStatus;
    
    await registration.save();

  } catch (error) {
    console.error("Error syncing registration fees:", error);
  }
};
