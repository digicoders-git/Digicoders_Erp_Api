import Razorpay from "razorpay";

let razorpay = null;

try {
  if (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET
  ) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  } else {
    console.warn("Razorpay keys are missing in environment variables");
  }
} catch (error) {
  console.error("Razorpay not configured:", error);
}

export default razorpay;
