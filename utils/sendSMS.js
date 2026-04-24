import axios from "axios";

export const sendSmsOtp = async (mobile, otp) => {
  const url = "http://sms.digicoders.in/api/sendhttp.php";

  const params = {
    authkey: `${process.env.SMS_API_AUTHKEY}`,
    mobiles: `91${mobile}`,
    message: `Your OTP Code is ${otp}. Do not share it with anyone. From DigiCoders. #TeamDigiCoders`,
    sender: `${process.env.SENDER_ID}`,
    route: 4,
    country: 91,
    DLT_TE_ID: `${process.env.DLT_TE_ID}`,
  };

  try {
    const response = await axios.get(url, { params });

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw error;
  }
};

export const sendSmsRegReminder = async (
  mobile,
  studentName,
  amount,
  paymentLink,
) => {
  const url = "http://sms.digicoders.in/api/sendhttp.php";
  // console.log(
  //   `Dear ${studentName}, registration is complete and seat is reserved. To confirm your seat at DigiCoders, please pay the Rs. ${amount} registration fee now: ${paymentLink}`,
  // );

  const params = {
    authkey: process.env.SMS_API_AUTHKEY,
    mobiles: `91${mobile}`,
    message: `Dear ${studentName}, registration is complete and seat is reserved. To confirm your seat at DigiCoders, please pay the Rs. ${amount} registration fee now: ${paymentLink}`,
    sender: process.env.SENDER_ID,
    route: 4,
    country: 91,
    DLT_TE_ID: "1707177088560502273",
  };

  try {
    const response = await axios.get(url, { params });
    // console.log(response);

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw error;
  }
};

export const sendSmsRegSuccess = async (
  mobile,
  studentName,
  trainingName,
  technologyName,
) => {
  const url = "http://sms.digicoders.in/api/sendhttp.php";
  console.log(
    `Dear ${studentName}, your registration for ${trainingName} in ${technologyName} is successful. Welcome to DigiCoders Technologies Pvt. Ltd.`,
  );
  const params = {
    authkey: process.env.SMS_API_AUTHKEY,
    mobiles: `91${mobile}`,
    message: `Dear ${studentName}, your registration for ${trainingName} in ${technologyName} is successful. Welcome to DigiCoders Technologies Pvt. Ltd.`,
    sender: process.env.SENDER_ID,
    route: 4,
    country: 91,
    DLT_TE_ID: `1707177087832601548`,
  };

  try {
    const response = await axios.get(url, { params });

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw error;
  }
};

export const sendSmsFeeReminder = async (mobile, studentName, dueAmount) => {
  const url = "http://sms.digicoders.in/api/sendhttp.php";
  console.log(
    "Dear {#var#}, your training fee of ₹{#var#} is pending at DigiCoders. Kindly pay the due amount at the earliest.",
  );

  const params = {
    authkey: `${process.env.SMS_API_AUTHKEY}`,
    mobiles: `91${mobile}`,
    message: `Dear ${studentName}, your training fee of Rs. ${dueAmount} is pending at DigiCoders. Kindly pay the due amount at the earliest.`,
    sender: `${process.env.SENDER_ID}`,
    route: 4,
    country: 91,
    DLT_TE_ID: `1707177087870497587`,
  };

  try {
    const response = await axios.get(url, { params });

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw error;
  }
};

export const sendSmsInstallmentReceived = async (
  mobile,
  studentName,
  amount,
) => {
  const url = "http://sms.digicoders.in/api/sendhttp.php";
  console.log(
    "Dear Krishna, ₹5000 installment received. Thank you for the payment. - DigiCoders Technologies Pvt. Ltd.",
  );

  const params = {
    authkey: "370038Amo3cZx0h696a3f7dP1",
    mobiles: `91${mobile}`,
    message: `Dear ${studentName}, Rs. ${amount} installment received. Thank you for the payment. - DigiCoders Technologies Pvt. Ltd.`,
    sender: "DIGICO",
    route: 4,
    country: 91,
    DLT_TE_ID: "1707177088053515001",
  };

  try {
    const response = await axios.get(url, { params });

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw error;
  }
};

export const sendSmsReminder = async (mobile, message) => {
  const url = "http://sms.digicoders.in/api/sendhttp.php";

  const params = {
    authkey: "370038Amo3cZx0h696a3f7dP1",
    mobiles: `91${mobile}`,
    message: message,
    sender: "DIGICO",
    route: 4,
    country: 91,
    DLT_TE_ID: "1307164706435757762",
  };

  try {
    const response = await axios.get(url, { params });

    return response.data;
  } catch (error) {
    console.error("SMS Error:", error.message);
    throw error;
  }
};
