import Registration from "../models/regsitration.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import College from "../models/college.js";
import TechnologyModal from "../models/technology.js";
import razorpay from "../utils/razorpay.js";
import Fee from "../models/fee.js";
import { sendEmail, sendRegistrationSuccessEmail, sendPaymentReminderEmail, sendPaymentSuccessEmail } from "../utils/sendEmail.js";
import {
  sendSmsOtp,
  sendSmsRegSuccess,
  sendSmsRegReminder,
} from "../utils/sendSMS.js";

// Add new registration
export const addRegistration = async (req, res) => {
  try {
    const {
      mobile,
      whatshapp,
      studentName,
      training,
      technology,
      education,
      eduYear,
      fatherName,
      email,
      alternateMobile,
      hrName,
      branch,
      collegeName,
      discount,
      discountRemark,
      amount,
      tnxStatus,
      paymentType,
      paymentMethod,
      password,
      qrcode,
      remark,
      tnxId,
      registeredBy,
      tag,
      isNocAllowed,
    } = req.body;

    // Get technology price if amount not provided
    const tech = await TechnologyModal.findById(technology).select("price");
    const totalFee = tech.price;
    const finalFee = totalFee - discount;
    // Validate payment type
    if (!["registration", "full"].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment type. Use 'registration' or 'full'",
      });
    }

    // Payment method validation
    let paymentLink = null;
    let finalTnxStatus = tnxStatus || "paid"; // Default status
    let finalTnxId = tnxId;

    if (paymentMethod === "cash") {
      // Cash payment - direct registration
      finalTnxStatus = "paid";
      finalTnxId = undefined;
    } else if (paymentMethod === "upi_qr") {
      if (!tnxId || !qrcode) {
        return res.status(400).json({
          success: false,
          message:
            "Transaction ID or select Qrcode required for UPI QR payment",
        });
      }
      const existingTxn = await Registration.findOne({ tnxId });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already used",
        });
      }
      finalTnxStatus = "paid";
    } else if (paymentMethod === "pos") {
      if (!tnxId) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID required for POS payment",
        });
      }
      const existingTxn = await Registration.findOne({ tnxId });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already used",
        });
      }
      finalTnxStatus = "paid";
    } else if (paymentMethod === "payment_link") {
      if (razorpay) {
        try {
          paymentLink = await razorpay.paymentLink.create({
            amount: amount * 100,
            currency: "INR",
            description: `DigiCoders Registration - ${studentName}`,
            customer: {
              name: studentName,
              contact: `+91${mobile}`,
              email: email,
            },
            notify: {
              sms: true,
              email: true,
            },
            reminder_enable: true,
            callback_url: `${process.env.BACKEND_URL}/api/razorpay/verify-payment-link`,
            callback_method: "get",
          });

          finalTnxStatus = "pending";
          finalTnxId = paymentLink.id;
        } catch (error) {
          console.error("Razorpay error:", error);
          // Don't fail registration, just set pending status
          finalTnxStatus = "pending";
          finalTnxId = `manual_${Date.now()}`;
        }
      } else {
        // Razorpay not configured, set manual payment
        finalTnxStatus = "pending";
        finalTnxId = `manual_${Date.now()}`;
      }
    } else if (paymentMethod === "emi") {
      finalTnxStatus = "pending";
      finalTnxId = `emi_${Date.now()}`;
    }

    if (["upi_qr", "pos"].includes(paymentMethod) && tnxId) {
      const existingTxn = await Registration.findOne({ tnxId: tnxId });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already used for another registration",
        });
      }
    }
    const cleanTnxId = ["upi_qr", "pos", "payment_link", "emi"].includes(
      paymentMethod,
    )
      ? finalTnxId
      : undefined;

    // Create new registration
    const newRegistration = await Registration.create({
      mobile,
      whatshapp,
      studentName,
      training,
      technology,
      education,
      eduYear,
      fatherName,
      email,
      alternateMobile,
      hrName,
      branch,
      collegeName,
      totalFee,
      discount,
      discountRemark,
      finalFee,
      amount,
      status: paymentMethod === "payment_link" ? "accepted" : "new",
      paidAmount: Number(amount),
      dueAmount: Math.max(Number(finalFee) - Number(amount), 0),
      tnxStatus: finalTnxStatus,
      trainingFeeStatus: Number(amount) >= Number(finalFee) ? "full paid" : (Number(amount) > 0 ? "partial" : "pending"),
      paymentType,
      paymentMethod,
      password,
      qrcode,
      remark,
      tnxId: cleanTnxId,
      registeredBy: registeredBy || null,
      tag: tag || null,
      isNocAllowed: isNocAllowed === "true" || isNocAllowed === true || false,
      paymentLink: paymentLink?.short_url || null,
    });

    const savedRegistration = await newRegistration.save();
    if (amount > 0) {
      const feePayment = await Fee.create({
        registrationId: savedRegistration._id,
        totalFee,
        discount,
        finalFee,
        paidAmount: Number(amount),
        dueAmount: Math.max(Number(finalFee) - Number(amount), 0),
        amount: Number(amount),
        paymentType: paymentType,
        mode: paymentMethod,
        qrcode,
        tnxId: cleanTnxId,
        status: paymentMethod === "payment_link" ? "accepted" : "new",
        tnxStatus: finalTnxStatus,
        paymentLink: paymentLink?.short_url || null,
      });

      await feePayment.save();
    }
    const populatedRegistration = await Registration.findById(
      savedRegistration._id,
    )
      .select("-password")
      .populate("training", "name ")
      .populate("technology", "name ")
      .populate("education", "name")
      .populate("hrName", "name")
      .populate("tag", "name");

    const { password: _, ...userResponse } = savedRegistration.toObject();

    // Send SMS and Email based on payment method
    if (paymentMethod === "payment_link" && paymentLink?.short_url) {
      // Payment link reminder
      await sendSmsRegReminder(
        populatedRegistration.mobile,
        populatedRegistration.studentName,
        amount,
        paymentLink.short_url,
      );
      if (email) {
        await sendPaymentReminderEmail(email, {
          studentName: populatedRegistration.studentName,
          training: populatedRegistration.training?.name,
          technology: populatedRegistration.technology?.name,
          amount,
          paymentLink: paymentLink.short_url,
        });
      }
    } else {
      // Registration success
      await sendSmsRegSuccess(
        populatedRegistration.mobile,
        populatedRegistration.studentName,
        populatedRegistration.training.name,
        populatedRegistration.technology.name,
      );
      if (email) {
        await sendRegistrationSuccessEmail(email, {
          studentName: populatedRegistration.studentName,
          training: populatedRegistration.training?.name,
          technology: populatedRegistration.technology?.name,
          totalFee: populatedRegistration.totalFee,
          discount: populatedRegistration.discount,
          finalFee: populatedRegistration.finalFee,
          paidAmount: populatedRegistration.paidAmount,
          dueAmount: populatedRegistration.dueAmount,
          mobile: populatedRegistration.mobile,
        });
      }
    }
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: userResponse,
      populatedRegistration,
      paymentLink: paymentLink?.short_url || null,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Validation failed",
        error: error.message,
      });
    }

    res.status(400).json({
      success: false,
      message: error.message || "Registration failed",
      error: error.message,
    });
  }
};

//login student email / mobile / UserId
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide username and password",
      });
    }
    const query = {
      $or: [
        { email: username },
        { mobile: username },
        { userid: username },
      ],
    };

    if (mongoose.Types.ObjectId.isValid(username)) {
      query.$or.push({ _id: username });
    }

    const user = await Registration.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    // 🔒 Check if password is set by student
    if (!user.isPasswordSet) {
      return res.status(401).json({
        success: false,
        message: "First-time login must be via OTP. Please login using OTP and set your password in your profile.",
      });
    }

    // 🔒 Check password
    const isMatch = String(user.password) === String(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check registration status and payment status
    if (!["accepted", "new"].includes(user.status)) {
      return res.status(403).json({
        success: false,
        message:
          "Your registration is not yet active. Please contact administrator.",
      });
    }

    if (!["paid", "full paid"].includes(user.tnxStatus)) {
      return res.status(403).json({
        success: false,
        message:
          "Your registration payment is pending. Please complete the payment to login.",
      });
    }
    // 🔐 Generate JWT token
    const accessToken = await user.generateToken();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: Number(process.env.COOKIE_EXPIRE),
    });

    return res.status(200).json({ 
      message: "login successfull", 
      success: true, 
      user,
      accessToken
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ message: "internal server error", success: false, error });
  }
};

//get singal user by email or mobile or id
export const getOneRegistrations = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Please provide username",
      });
    }

    const registration = await Registration.find({
      $or: [{ email: username }, { mobile: username }, { userid: username }],
      status: { $ne: "rejected" },
    })
      .select("+password")
      .populate("training", "name")
      .populate("technology", "name")
      .populate("education", "name")
      .populate("registeredBy", "name email")
      .populate("verifiedBy", "name email")
      .populate("hrName", "name")
      .populate("tag", "name")
      .populate("branch", "name")
      .populate("qrcode", "name upi")
      .sort({ createdAt: -1 });

    if (!registration || registration.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Registration not found with this mobile number",
      });
    }

    // Normalize isPasswordSet for legacy accounts and remove sensitive password
    const data = registration.map(reg => {
      const obj = reg.toObject();
      // If isPasswordSet is explicitly false/undefined but they have a password set (different from mobile)
      if (!obj.isPasswordSet && obj.password && obj.password !== obj.mobile) {
        obj.isPasswordSet = true;
      }
      delete obj.password;
      return obj;
    });

    return res.status(200).json({
      success: true,
      data: data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching registration",
      error: error.message,
    });
  }
};

// Get single registration by ID or email
export const getRegistration = async (req, res) => {
  try {
    const { id, email, userid } = req.query;

    let query = {};
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ID format",
        });
      }
      query._id = id;
    } else if (email) {
      query.email = email;
    } else if (userid) {
      query.userid = userid;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide id, email, or userid",
      });
    }

    const registration = await Registration.findOne(query)
      .select("-password")
      .populate({
        path: "training",
        select: "name duration",
        populate: {
          path: "duration", // 👈 duration training ke andar
          select: "name", // jo fields chahiye
        },
      })
      .populate("technology", "name")
      .populate("education", "name")
      .populate("registeredBy", "name email")
      .populate("verifiedBy", "name email")
      .populate("hrName", "name")
      .populate("branch", "name")
      .populate("qrcode", "name upi")
      .populate("batch", "batchName startDate")
      .populate("tag", "name")
      .populate("collegeName");

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      data: registration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching registration",
      error: error.message,
    });
  }
};

export const getAllRegistrations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      training,
      technology,
      education,
      status,
      acceptStatus,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      collegeName,
      eduYear,
      branch,
      paymentMethod,
      trainingFeeStatus,
      tnxStatus,
      hrName,
      startDate, // Add start date
      endDate, // Add end date
    } = req.query;

    // Build filter object
    const filter = {};
    const logdInUser = req.user;
    // Status filters
    if (status && status !== "All") filter.status = status;
    if (acceptStatus && acceptStatus !== "All")
      filter.acceptStatus = acceptStatus;
    // Date range filter - FIXED
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // Related entity filters (MongoDB ObjectId)
    if (training && training !== "All")
      filter.training = new mongoose.Types.ObjectId(training);
    if (technology && technology !== "All")
      filter.technology = new mongoose.Types.ObjectId(technology);
    if (education && education !== "All")
      filter.education = new mongoose.Types.ObjectId(education);
    // 🔐 Role based branch restriction
    // if (logdInUser.role === "Employee") {
    //   filter.branch = new mongoose.Types.ObjectId(logdInUser.branch);
    // }

    //     if (branch && branch !== "All")
    //       filter.branch = new mongoose.Types.ObjectId(branch);
    // 🔐 Role based branch restriction (FINAL)
    if (logdInUser.role !== "Super Admin") {
      // Admin & Employee → only their own branch
      filter.branch = new mongoose.Types.ObjectId(logdInUser.branch);
    } else {
      // Super Admin → can filter by any branch
      if (branch && branch !== "All") {
        filter.branch = new mongoose.Types.ObjectId(branch);
      }
    }

    if (hrName && hrName !== "All")
      filter.hrName = new mongoose.Types.ObjectId(hrName);
    if (collegeName && collegeName !== "All")
      filter.collegeName = new mongoose.Types.ObjectId(collegeName);

    // Direct field filters (String fields only for $regex)
    if (eduYear && eduYear !== "All") filter.eduYear = eduYear;
    if (paymentMethod && paymentMethod !== "All")
      filter.paymentMethod = paymentMethod;
    if (trainingFeeStatus && trainingFeeStatus !== "All")
      filter.trainingFeeStatus = trainingFeeStatus;
    if (tnxStatus && tnxStatus !== "All") filter.tnxStatus = tnxStatus;
    // if (hrName) match["hrName._id"] = hrName;

    // Search functionality - ONLY for String fields
    if (search && search.trim()) {
      filter.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { fatherName: { $regex: search, $options: "i" } },
        { mobile: { $regex: search, $options: "i" } },
        { whatshapp: { $regex: search, $options: "i" } },
        { userid: { $regex: search, $options: "i" } },
        { alternateMobile: { $regex: search, $options: "i" } },
        { tnxId: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { "collegeName.name": { $regex: search, $options: "i" } },
        { "collegeName.district": { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sorting - validate sort fields
    const sort = {};
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "studentName",
      "fatherName",
      "mobile",
      "amount",
      "totalFee",
      "paidAmount",
      "dueAmount",
      "status",
    ];

    if (sortBy && allowedSortFields.includes(sortBy)) {
      sort[sortBy] = sortOrder === "asc" ? 1 : -1;
    } else {
      sort.createdAt = -1; // Default sort
    }

    // Build query
    const query = Registration.find(filter)
      .select("-password")
      .populate("training", "name duration")
      .populate("technology", "name duration")
      .populate("education", "name")
      .populate("registeredBy", "name email")
      .populate("verifiedBy", "name email")
      .populate("branch", "name")
      .populate("qrcode", "name image")
      .populate("hrName", "name")
      .populate("tag", "name")
      .populate("collegeName", "name district") // Add this line
      .populate("batch", "batchName") // Add this line
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Execute query
    const registrations = await query.lean();

    // Get total count for pagination
    const total = await Registration.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: registrations,
      count: registrations.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        hasNext: pageNum < Math.ceil(total / limitNum),
        hasPrev: pageNum > 1,
        limit: limitNum,
      },
    });
  } catch (error) {
    console.error("Error fetching registrations:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching registrations",
      error: error.message,
    });
  }
};
// Update registration
export const updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const files = req.files || {};

    const {
      whatshapp,
      studentName,
      email,
      mobile,
      training,
      technology,
      education,
      eduYear,
      fatherName,
      alternateMobile,
      joiningData,
      isJoin,
      dateOfBirth,
      gender,
      address,
      district,
      pincode,
      guardianMobile,
      guardianMobileVerification,
      guardianRelation,
      higherEducation,
      lastQualification,
      idCardIssued,
      certificateIssued,
      hardForm,
      aadharCardUploded,
      tSartIssued,
      isJobNeed,
      placementStatus,
      cvUploded,
      placeInCompany,
      interviewInCompanines,
      photoSummited,
      branch,
      collegeName,
      hrName,
      batch,
      discount,
      discountRemark,
      qrcode,
      isStatus,
      tnxId,
      remark,
      tag,
      password,
      isNocAllowed,
      totalFee,
      finalFee,
      amount,
      paidFee,
      dueFee,
    } = body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Registration ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Find the existing registration
    const student = await Registration.findById(id).populate("technology");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (files.profilePhoto) {
      if (!student.profilePhoto) student.profilePhoto = {};
      student.profilePhoto.url = `/uploads/${files.profilePhoto[0].filename}`;
      student.profilePhoto.public_id = files.profilePhoto[0].filename;
    }

    if (files.cv) {
      if (!student.cv) student.cv = {};
      student.cv.url = `/uploads/${files.cv[0].filename}`;
      student.cv.public_id = files.cv[0].filename;
      student.cvUploded = true;
    }

    if (files.aadharCard) {
      if (!student.aadharCard) student.aadharCard = {};
      student.aadharCard.url = `/uploads/${files.aadharCard[0].filename}`;
      student.aadharCard.public_id = files.aadharCard[0].filename;
      student.aadharCardUploded = true;
    }

    if (whatshapp) student.whatshapp = whatshapp;
    if (studentName) student.studentName = studentName;
    if (email) student.email = email;
    if (mobile) student.mobile = mobile;
    if (eduYear) student.eduYear = eduYear;
    if (fatherName) student.fatherName = fatherName;
    if (alternateMobile) student.alternateMobile = alternateMobile;
    if (joiningData) student.joiningData = joiningData;
    if (typeof isJoin !== "undefined") student.isJoin = isJoin;
    if (dateOfBirth) student.dateOfBirth = dateOfBirth;
    if (gender) student.gender = gender;
    if (address) student.address = address;
    if (district) student.district = district;
    if (pincode) student.pincode = pincode;
    if (guardianMobile) student.guardianMobile = guardianMobile;
    if (typeof guardianMobileVerification !== "undefined")
      student.guardianMobileVerification = guardianMobileVerification;
    if (guardianRelation) student.guardianRelation = guardianRelation;
    if (higherEducation) student.higherEducation = higherEducation;
    if (lastQualification) student.lastQualification = lastQualification;
    if (typeof idCardIssued !== "undefined")
      student.idCardIssued = idCardIssued;
    if (typeof certificateIssued !== "undefined")
      student.certificateIssued = certificateIssued;
    if (typeof hardForm !== "undefined") student.hardForm = hardForm;
    if (typeof aadharCardUploded !== "undefined")
      student.aadharCardUploded = aadharCardUploded;
    if (typeof tSartIssued !== "undefined") student.tSartIssued = tSartIssued;
    if (typeof isJobNeed !== "undefined") student.isJobNeed = isJobNeed;
    if (typeof placementStatus !== "undefined")
      student.placementStatus = placementStatus;
    if (typeof cvUploded !== "undefined") student.cvUploded = cvUploded;
    if (placeInCompany) student.placeInCompany = placeInCompany;
    if (interviewInCompanines)
      student.interviewInCompanines = interviewInCompanines;
    if (typeof photoSummited !== "undefined")
      student.photoSummited = photoSummited;
    if (typeof isNocAllowed !== "undefined")
      student.isNocAllowed = isNocAllowed === "true" || isNocAllowed === true;

    if (branch) student.branch = branch;
    if (collegeName) student.collegeName = collegeName;
    if (hrName) student.hrName = hrName;
    if (batch) student.batch = batch;
    if (qrcode) student.qrcode = qrcode;
    if (typeof isStatus !== "undefined") student.isStatus = isStatus;
    if (tnxId) student.tnxId = tnxId;
    if (remark) student.remark = remark;
    if (tag) student.tag = tag;
    if (password) student.password = password;
    if (training) student.training = training;
    if (education) student.education = education;
    if (discountRemark) student.discountRemark = discountRemark;
    if (typeof paidFee !== "undefined" && paidFee !== "") student.paidAmount = Number(paidFee);
    if (typeof dueFee !== "undefined" && dueFee !== "") student.dueAmount = Number(dueFee);
    if (typeof amount !== "undefined" && amount !== "") student.amount = Number(amount);
    if (typeof discount !== "undefined" && discount !== "") {
      student.discount = Number(discount);
      student.finalFee = student.totalFee - Number(discount);
      student.dueAmount = Math.max(student.finalFee - student.paidAmount, 0);
    }
    if (typeof totalFee !== "undefined" && totalFee !== "") {
      student.totalFee = Number(totalFee);
      student.finalFee = Number(totalFee) - (Number(discount) || student.discount || 0);
    }
    // If technology is being changed, fetch the new technology's price
    if (technology && technology !== student.technology._id) {
      const newTechnology = await TechnologyModal.findById(technology);
      if (!newTechnology) {
        return res.status(404).json({
          success: false,
          message: "Technology not found",
        });
      }

      // Update technology and total fee
      student.technology = technology;
      student.totalFee = newTechnology.price;

      // Recalculate final fee and due fee
      student.finalFee = student.totalFee - student.discount;

      student.dueAmount =
        newTechnology.price - student.paidAmount - student.discount;
    }

    // Save the updated student
    await student.save();

    res.status(200).json({
      success: true,
      message: "Registration updated successfully",
      data: student,
    });
  } catch (error) {
    console.error("Update error:", error);
    res.status(400).json({
      success: false,
      message: "Error updating registration",
      error: error.message,
    });
  }
};
// Update registration status
export const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Registration ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    // Validate status values
    const validStatuses = ["new", "accepted", "rejected", "pending"];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: new, accepted, rejected",
      });
    }

    // Build update object
    const updateData = {};
    if (status) updateData.status = status;
    // if (acceptStatus) updateData.acceptStatus = acceptStatus;
    if (status === "accepted") updateData.tnxStatus = "paid";
    if (status === "rejected") {
      updateData.tnxStatus = "failed";
      updateData.trainingFeeStatus = "pending";
      await Fee.updateMany({ registrationId: id }, { tnxStatus: "failed" });
    }

    // Set verifiedBy to current user
    updateData.verifiedBy = user._id;

    const updatedRegistration = await Registration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    );
    if (!updatedRegistration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Registration status updated successfully",
      data: updatedRegistration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating registration status",
      error: error.message,
    });
  }
};

// Delete registration
export const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Registration ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ID format",
      });
    }

    const deletedRegistration = await Registration.findByIdAndDelete(id);

    if (!deletedRegistration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Registration deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting registration",
      error: error.message,
    });
  }
};

// export const sendmail = async (req, res) => {
//   try {
//     const { mobile } = req.body;

//     await sendSMS(
//       mobile,
//       `Hi KRISHNA KUMAR, thank you for registering at DigiCoders.`,
//     );
//     res.status(200).json({ success: true, message: "Email sent successfully" });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error sending email",
//       error: error.message,
//     });
//   }
// };
export const sendOtp = async (req, res) => {
  try {
    const { userid } = req.body;
    const student = await Registration.findById(userid);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Invalid userid or mobile",
      });
    }
    // Check registration status and payment status
    if (student.status !== "accepted") {
      return res.status(403).json({
        success: false,
        message:
          "Your registration is not yet accepted. Please contact administrator.",
      });
    }

    if (!["paid", "full paid"].includes(student.tnxStatus)) {
      return res.status(403).json({
        success: false,
        message:
          "Your registration payment is pending. Please complete the payment to login.",
      });
    }

    const newotp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    student.otp = newotp;
    student.otpExpire = Date.now() + 5 * 60 * 1000;
    await student.save();

    // 📧 Email OTP
    if (student.email) {
      await sendEmail(
        student.email,
        "OTP Verification - DigiCoders",
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP Verification</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 0; margin: 0;">
  <table align="center" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 20px auto;">
    <tr>
      <td style="background: linear-gradient(135deg, #0d6efd, #0b5ed7); padding: 25px; text-align: center; color: #ffffff;">
        <h1 style="margin: 0; font-size: 28px; font-weight: 600;">DigiCoders</h1>
        <p style="margin: 10px 0 0; font-size: 14px;">OTP Verification</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px; text-align: center;">
        <h2 style="color: #333333; margin-top: 0;">Your OTP Code</h2>
        <p style="font-size: 16px; color: #555555; line-height: 1.6;">Use the following OTP to complete your verification:</p>
        <div style="background-color: #f8f9fa; border-radius: 6px; padding: 20px; margin: 25px 0; border: 2px dashed #0d6efd;">
          <h1 style="margin: 0; color: #0d6efd; font-size: 36px; letter-spacing: 8px;">${newotp}</h1>
        </div>
        <p style="font-size: 14px; color: #888888;">This OTP is valid for 5 minutes only.</p>
        <div style="background-color: #fff3cd; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; font-size: 14px; color: #856404;">⚠️ <strong>Security Notice:</strong> Do not share this OTP with anyone.</p>
        </div>
        <p style="font-size: 14px; color: #888888; margin-top: 20px;">If you didn't request this OTP, please ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 12px; color: #666666;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} DigiCoders. All rights reserved.</p>
        <p style="margin: 5px 0 0; font-size: 11px;">#TeamDigiCoders</p>
      </td>
    </tr>
  </table>
</body>
</html>`,
      );
    }
    // 📱 SMS OTP
    await sendSmsOtp(student.mobile, newotp);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      newotp,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error sending OTP",
      error: error.message,
    });
  }
};
export const verifyOtp = async (req, res) => {
  try {
    const { otp, userid } = req.body;

    const student = await Registration.findById(userid);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Invalid user",
      });
    }

    // ❌ OTP not generated or already used
    if (!student.otp) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or already verified",
      });
    }

    // ❌ OTP expired
    if (student.otpExpire < Date.now()) {
      student.otp = null;
      student.otpExpire = null;
      await student.save();

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    // ❌ OTP mismatch
    if (String(student.otp) !== String(otp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // ✅ OTP verified → clear OTP
    student.otp = null;
    student.otpExpire = null;
    await student.save();

    // 🔐 Generate JWT token
    const accessToken = await student.generateToken();

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: true, // production me true
      sameSite: "None", // frontend different domain ho to
      maxAge: Number(process.env.COOKIE_EXPIRE),
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      userId: student._id,
      accessToken,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying OTP",
    });
  }
};

export const verifyPaymentLink = async (req, res) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_payment_link_id,
      razorpay_payment_link_status,
    } = req.body;

    if (
      razorpay_payment_link_status === "paid" &&
      razorpay_payment_id &&
      razorpay_payment_link_id
    ) {
      // Find registration by payment link ID
      const registration = await Registration.findOne({
        tnxId: razorpay_payment_link_id,
      }).populate("training", "name")
        .populate("technology", "name");

      if (registration) {
        // Update payment status
        registration.tnxStatus = "paid";
        registration.tnxId = razorpay_payment_id;
        
        // Update paid and due amounts
        registration.paidAmount = registration.amount;
        registration.dueAmount = Math.max(registration.finalFee - registration.amount, 0);
        
        // Determine training fee status
        if (registration.paymentType === "full" || registration.dueAmount === 0) {
          registration.trainingFeeStatus = "full paid";
        } else {
          registration.trainingFeeStatus = "partial";
        }
        
        await registration.save();

        // Update fee record
        const feeRecord = await Fee.findOne({
          registrationId: registration._id,
        });
        if (feeRecord) {
          feeRecord.tnxStatus = "paid";
          feeRecord.tnxId = razorpay_payment_id;
          await feeRecord.save();
        }

        // Send confirmation
        try {
          await sendSmsRegSuccess(
            registration.mobile,
            registration.studentName,
            registration.training?.name,
            registration.technology?.name,
          );
          if (registration.email) {
            await sendPaymentSuccessEmail(registration.email, {
              studentName: registration.studentName,
              training: registration.training?.name,
              technology: registration.technology?.name,
              paymentId: razorpay_payment_id,
              amount: registration.amount,
              mobile: registration.mobile,
            });
          }
        } catch (error) {
          console.error("Notification failed:", error);
        }

        return res.status(200).json({
          success: true,
          message: "Payment verified and status updated successfully",
          data: {
            registrationId: registration._id,
            studentName: registration.studentName,
            paymentId: razorpay_payment_id,
          },
        });
      } else {
        return res.status(404).json({
          success: false,
          message: "Registration not found for this payment link",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed - invalid payment status",
      });
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: error.message,
    });
  }
};

// export const verifyRegistrationfeeWeb = async (req, res) => {
//   try {
//     const {
//       razorpay_payment_id,
//       razorpay_payment_link_id,
//       razorpay_payment_link_status,
//     } = req.body;

//     if (
//       razorpay_payment_link_status === "paid" &&
//       razorpay_payment_id &&
//       razorpay_payment_link_id
//     ) {
//       // Find registration by payment link ID
//       const registration = await Registration.findOne({
//         tnxId: razorpay_payment_link_id,
//       });

//       if (registration) {
//         // Update payment status
//         registration.tnxStatus = "paid";
//         registration.tnxId = razorpay_payment_id;
//         registration.trainingFeeStatus =
//           registration.paymentType === "full" ? "full paid" : "pending";
//         await registration.save();

//         // Update fee record
//         const feeRecord = await Fee.findOne({
//           registrationId: registration._id,
//         });
//         if (feeRecord) {
//           feeRecord.tnxStatus = "paid";
//           feeRecord.tnxId = razorpay_payment_id;
//           await feeRecord.save();
//         }

//         // Send confirmation SMS
//         try {
//           await sendSmsOtp(
//             registration.mobile,
//             `Payment successful! Your DigiCoders registration confirmed. Payment ID: ${razorpay_payment_id} - Team DigiCoders`,
//           );
//         } catch (smsError) {
//           console.error("SMS failed:", smsError);
//         }

//         return res.status(200).json({
//           success: true,
//           message: "Payment verified and status updated successfully",
//           data: {
//             registrationId: registration._id,
//             studentName: registration.studentName,
//             paymentId: razorpay_payment_id,
//           },
//         });
//       } else {
//         return res.status(404).json({
//           success: false,
//           message: "Registration not found for this payment link",
//         });
//       }
//     } else {
//       return res.status(400).json({
//         success: false,
//         message: "Payment verification failed - invalid payment status",
//       });
//     }
//   } catch (error) {
//     console.error("Payment verification error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Payment verification failed",
//       error: error.message,
//     });
//   }
// };

// Add new registration
export const RegistrationByWeb = async (req, res) => {
  try {
    const {
      mobile,
      studentName,
      training,
      technology,
      education,
      eduYear,
      fatherName,
      email,
      alternateMobile,
      branch,
      collegeName,
      amount,
      tnxStatus,
      paymentType,
      paymentMethod,
      tnxId,
    } = req.body;

    // Get technology price if amount not provided
    const tech = await TechnologyModal.findById(technology).select("price");
    if (!tech) {
      return res.status(404).json({
        success: false,
        message: "Chosen technology not found",
      });
    }
    const totalFee = tech.price || 0;
    const finalFee = totalFee;
    // Validate payment type
    if (!["registration", "full"].includes(paymentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment type. Use 'registration' or 'full'",
      });
    }
    // Create new registration
    const newRegistration = new Registration({
      mobile,
      whatshapp: mobile,
      studentName,
      training,
      technology,
      education,
      eduYear,
      fatherName,
      email,
      alternateMobile,
      branch,
      collegeName,
      totalFee,
      finalFee,
      amount,
      status: "new",
      paidAmount: paymentMethod === "online" ? 0 : amount,
      dueAmount: finalFee - (paymentMethod === "online" ? 0 : amount),
      tnxStatus: paymentMethod === "online" ? "pending" : tnxStatus,
      trainingFeeStatus: "pending",
      paymentType,
      paymentMethod,
    });

    const savedRegistration = await newRegistration.save();

    let razorpayOrder = null;
    if (paymentMethod === "online" && razorpay) {
      razorpayOrder = await razorpay.orders.create({
        amount: amount * 100, // paise
        currency: "INR",
        receipt: `WEB-REG-${savedRegistration._id}`,
        notes: {
          registrationId: savedRegistration._id.toString(),
        },
      });
      
      // Save order id to registration
      savedRegistration.paymentLink = razorpayOrder.id; // Using paymentLink field as temp storage or add a new one
      await savedRegistration.save();
    }
    let feeId = null;
    if (amount > 0) {
      const feePayment = await Fee.create({
        registrationId: savedRegistration._id,
        totalFee,
        finalFee,
        paidAmount: amount,
        dueAmount: finalFee - amount,
        amount: amount,
        paymentType,
        mode: paymentMethod, // Pass mode to Fee
        status: "new",
        tnxStatus: paymentMethod === 'online' ? 'pending' : tnxStatus,
      });

      const savedFee = await feePayment.save();
      feeId = savedFee._id;
    }
    const populatedRegistration = await Registration.findById(
      savedRegistration._id,
    )
      .select("-password")
      .populate("training", "name ")
      .populate("technology", "name ")
      .populate("education", "name")
      .populate("hrName", "name")
      .populate("tag", "name");

    const { password: _, ...userResponse } = savedRegistration.toObject();

    // Send notifications only for offline payment
    if (paymentMethod !== "online") {
      await sendSmsRegSuccess(
        populatedRegistration.mobile,
        populatedRegistration.studentName,
        populatedRegistration.training.name,
        populatedRegistration.technology.name,
      );
      if (email) {
        await sendRegistrationSuccessEmail(email, {
          studentName: populatedRegistration.studentName,
          training: populatedRegistration.training?.name,
          technology: populatedRegistration.technology?.name,
          totalFee: populatedRegistration.totalFee,
          discount: populatedRegistration.discount,
          finalFee: populatedRegistration.finalFee,
          paidAmount: populatedRegistration.paidAmount,
          dueAmount: populatedRegistration.dueAmount,
          mobile: populatedRegistration.mobile,
        });
      }
    }
    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: userResponse,
      populatedRegistration,
      razorpayOrder,
      razorpayKey: process.env.RAZORPAY_KEY_ID,
      feeId
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages[0] || "Validation failed",
        error: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Registration failed",
      error: error.message,
    });
  }

};
