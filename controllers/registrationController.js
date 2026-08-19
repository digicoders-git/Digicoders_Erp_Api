import Registration from "../models/regsitration.js";
import User from "../models/User.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import College from "../models/college.js";
import TechnologyModal from "../models/technology.js";
import razorpay from "../utils/razorpay.js";
import Fee from "../models/fee.js";
import { syncRegistrationFees } from "../helpers/syncFee.js";
import Referral from "../models/referral.js";
import { sendEmail, sendRegistrationSuccessEmail, sendPaymentReminderEmail, sendPaymentSuccessEmail, sendExportOTPEmail, getLocationFromIP } from "../utils/sendEmail.js";
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
      referralCode,
      // Offer fields
      offerGiven,
      offerType,
      offerValue,
      offerDescription,
      offerValidTill,
      gender,
      nextDueDate,
      dueRemark,
    } = req.body;

    // Get technology price if amount not provided
    const tech = await TechnologyModal.findById(technology).select("price");
    const totalFee = tech.price;
    const originalPrice = totalFee; // Store original price before any offers
    
    // Calculate final fee with discount and offers
    let finalDiscount = discount || 0;
    
    // Apply offer if given
    if (offerGiven && offerType && offerValue) {
      if (offerType === "percentage") {
        finalDiscount += (totalFee * offerValue) / 100;
      } else if (offerType === "fixed_amount") {
        finalDiscount += offerValue;
      }
    }
    
    const finalFee = Math.max(totalFee - finalDiscount, 0);
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

    // ✅ Enhanced Transaction ID validation for ALL payment methods
    if (tnxId && tnxId.trim()) {
      const existingTxn = await Registration.findOne({ tnxId: tnxId.trim() });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already exists. Please use a unique Transaction ID.",
        });
      }
    }
    const cleanTnxId = ["upi_qr", "pos", "payment_link", "emi"].includes(
      paymentMethod,
    )
      ? finalTnxId
      : undefined;

    // Handle referral logic
    let referredBy = null;
    if (referralCode && referralCode.trim()) {
      const referrer = await Registration.findOne({ userid: referralCode.trim().toUpperCase() });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    // Ensure email is valid or auto-generated if missing
    let finalEmail = email ? email.trim().toLowerCase() : "";
    if (!finalEmail || !finalEmail.includes("@")) {
      const cleanName = (studentName || "student").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      finalEmail = `${cleanName || "student"}${mobile ? mobile.slice(-4) : ""}@gmail.com`;
    }

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
      email: finalEmail,
      alternateMobile,
      hrName,
      branch,
      collegeName,
      gender,
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
      referralCode: referralCode?.trim().toUpperCase() || null,
      referredBy: referredBy,
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      dueRemark: dueRemark || "",
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

    await syncRegistrationFees(savedRegistration._id);

    // Process referral rewards if applicable
    if (referredBy && referralCode) {
      try {
        // Determine training type and reward amount
        const trainingDoc = await Registration.findById(savedRegistration._id).populate('training');
        const trainingName = trainingDoc.training?.name?.toLowerCase() || '';
        
        let trainingType = 'summer'; // default
        let rewardAmount = 0;
        
        if (trainingName.includes('apprenticeship')) {
          trainingType = 'apprenticeship';
          // Get count of apprenticeship referrals for this referrer
          const apprenticeshipCount = await Referral.countDocuments({
            referrer: referredBy,
            trainingType: 'apprenticeship'
          });
          
          if (apprenticeshipCount < 5) {
            rewardAmount = 200; // First 5 apprenticeship referrals
          } else {
            rewardAmount = 500; // After 5 apprenticeship referrals (6th onwards)
          }
        } else {
          trainingType = 'summer';
          // Get count of summer referrals for this referrer
          const summerCount = await Referral.countDocuments({
            referrer: referredBy,
            trainingType: 'summer'
          });
          
          if (summerCount < 5) {
            rewardAmount = 100; // First 5 summer referrals
          } else if (summerCount < 20) {
            rewardAmount = 200; // 6-20 summer referrals
          } else {
            rewardAmount = 200; // After 20 summer referrals (keep at 200)
          }
        }
        
        // Create referral record
        await Referral.create({
          referrer: referredBy,
          referred: savedRegistration._id,
          referralCode: referralCode.trim().toUpperCase(),
          trainingType: trainingType,
          rewardAmount: rewardAmount,
          status: 'pending'
        });
        
        console.log(`Referral reward created: ₹${rewardAmount} for ${trainingType} training (referral #${trainingType === 'apprenticeship' ? apprenticeshipCount + 1 : summerCount + 1})`);
      } catch (referralError) {
        console.error('Referral processing error:', referralError);
        // Don't fail registration if referral processing fails
      }
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
    
    // 🔐 Single device login: Clear any existing session before creating new one
    // This ensures that if student is logged in on another device, that session becomes invalid
    if (user.currentSessionToken) {
      console.log(`Student ${user.userid} logging in from new device - invalidating previous session`);
    }
    
    // Update login tracking and device info
    user.isLogin = true;
    user.loginAt = new Date();
    user.logoutAt = null;
    
    // Store device information
    const userAgent = req.get('User-Agent') || 'Unknown';
    const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'Unknown';
    
    user.lastLoginDevice = {
      userAgent: userAgent,
      ip: userIP,
      loginTime: new Date()
    };
    
    // 🔐 Generate JWT token (this will automatically update currentSessionToken and invalidate old sessions)
    const accessToken = await user.generateToken();
    
    // Save user with new session token
    await user.save();

    // Set secure cookie with proper configuration
    const cookieMaxAge = parseInt(process.env.COOKIE_EXPIRE) || 30 * 24 * 60 * 60 * 1000; // 30 days default
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // none for cross-origin in production
      maxAge: cookieMaxAge,
    });

    return res.status(200).json({ 
      message: "Login successful", 
      success: true, 
      user: {
        id: user._id,
        userid: user.userid,
        name: user.studentName,
        email: user.email,
        mobile: user.mobile,
        role: 'student',
        branch: user.branch,
        isPasswordSet: user.isPasswordSet
      },
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
    const data = await Promise.all(registration.map(async (reg) => {
      const obj = reg.toObject();
      // If isPasswordSet is explicitly false/undefined but they have a password set (different from mobile)
      if (!obj.isPasswordSet && obj.password && obj.password !== obj.mobile) {
        obj.isPasswordSet = true;
      }
      delete obj.password;

      // Find last payment date
      const lastFee = await Fee.findOne({
        registrationId: reg._id,
      }).sort({ createdAt: -1 });

      obj.lastPaymentDate = lastFee ? lastFee.paymentDate || lastFee.createdAt : null;

      return obj;
    }));

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
      certificateIssued, // Add certificate issued
      hasDue, // Add has due
      isJoin,
      source, // NEW filter for panel vs direct
    } = req.query;

    // Build filter object
    const filter = {};
    const logdInUser = req.user;
    
    // Cancelled filter support
    if (req.query.isCancelled === 'true' || req.query.isCancelled === true) {
      filter.isCancelled = true;
    } else {
      filter.isCancelled = { $ne: true };
    }

    // Source filter (admin vs direct)
    if (source === "panel") {
      filter.registeredBy = { $ne: null };
    } else if (source === "direct") {
      filter.registeredBy = null;
    }

    // Status filters
    if (status && status !== "All") filter.status = status;
    if (acceptStatus && acceptStatus !== "All")
      filter.acceptStatus = acceptStatus;
    if (certificateIssued !== undefined && certificateIssued !== "All") {
      const isIssued = certificateIssued === 'true' || certificateIssued === true;
      if (isIssued) {
        filter.certificateIssued = true;
      } else {
        filter.certificateIssued = { $ne: true };
      }
    }
    if (hasDue === 'true' || hasDue === true) {
      filter.dueAmount = { $gt: 0 };
    }
    if (isJoin !== undefined && isJoin !== "All") {
      filter.isJoin = isJoin === 'true' || isJoin === true;
    }
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
      if (logdInUser.email === "ankul@gmail.com") {
        filter.branch = {
          $in: [
            new mongoose.Types.ObjectId("69eb32bc8e8bb1433f7cbc25"),
            new mongoose.Types.ObjectId("69eb32d28e8bb1433f7cbc4e")
          ]
        };
      } else {
        filter.branch = new mongoose.Types.ObjectId(logdInUser.branch);
      }
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
    if (eduYear && eduYear !== "All" && eduYear !== "") filter.eduYear = eduYear;
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
      registeredBy,
      nextDueDate,
      dueRemark,
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
      student.photoSummited = true; // ✅ Set photo submitted flag
      student.idCardIssued = true; // ✅ Auto-issue ID card when photo is uploaded
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
    if (email) {
      student.email = email.trim().toLowerCase();
    } else if (!student.email || !student.email.includes("@")) {
      const cleanName = (student.studentName || studentName || "student").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      student.email = `${cleanName || "student"}${student.mobile ? student.mobile.slice(-4) : ""}@gmail.com`;
    }
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
    if (registeredBy) student.registeredBy = registeredBy;
    
    // ✅ Transaction ID uniqueness validation
    if (tnxId && tnxId !== student.tnxId) {
      const existingTxn = await Registration.findOne({ 
        tnxId: tnxId,
        _id: { $ne: student._id } // Exclude current student
      });
      if (existingTxn) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID already exists. Please use a unique Transaction ID.",
        });
      }
      student.tnxId = tnxId;
    }
    if (remark) student.remark = remark;
    if (tag) student.tag = tag;
    if (password) student.password = password;
    if (training) student.training = training;
    if (education) student.education = education;
    if (discountRemark) student.discountRemark = discountRemark;
    if (typeof paidFee !== "undefined" && paidFee !== "") student.paidAmount = Number(paidFee);
    if (typeof dueFee !== "undefined" && dueFee !== "") student.dueAmount = Number(dueFee);
    if (typeof amount !== "undefined" && amount !== "") student.amount = Number(amount);
    
    // Auto-update training fee status based on paid amount
    if (typeof paidFee !== "undefined" || typeof dueFee !== "undefined" || typeof amount !== "undefined") {
      const currentPaidAmount = student.paidAmount || 0;
      const currentFinalFee = student.finalFee || 0;
      
      // Recalculate due amount to ensure consistency
      student.dueAmount = Math.max(currentFinalFee - currentPaidAmount, 0);
      
      if (currentPaidAmount >= currentFinalFee) {
        student.trainingFeeStatus = "full paid";
        student.tnxStatus = "full paid";
      } else if (currentPaidAmount > 0) {
        student.trainingFeeStatus = "partial";
        student.tnxStatus = "paid";
      } else {
        student.trainingFeeStatus = "pending";
        student.tnxStatus = "pending";
      }
    }
    if (typeof discount !== "undefined" && discount !== "") {
      const parsedDiscount = Number(discount);
      const possibleFinalFee = student.totalFee - parsedDiscount;
      const currentPaid = student.paidAmount || 0;
      
      // Prevent discount from making finalFee less than what is already paid
      if (possibleFinalFee < currentPaid) {
         student.discount = student.totalFee - currentPaid;
         student.finalFee = currentPaid;
      } else {
         student.discount = parsedDiscount;
         student.finalFee = possibleFinalFee;
      }
      student.dueAmount = Math.max(student.finalFee - student.paidAmount, 0);
      
      // Auto-update training fee status after discount change
      const currentPaidAmount = student.paidAmount || 0;
      const currentFinalFee = student.finalFee || 0;
      
      if (currentPaidAmount >= currentFinalFee) {
        student.trainingFeeStatus = "full paid";
        student.tnxStatus = "full paid";
      } else if (currentPaidAmount > 0) {
        student.trainingFeeStatus = "partial";
        student.tnxStatus = "paid";
      } else {
        student.trainingFeeStatus = "pending";
        student.tnxStatus = "pending";
      }
    }
    if (typeof totalFee !== "undefined" && totalFee !== "") {
      student.totalFee = Number(totalFee);
      student.finalFee = Number(totalFee) - (Number(discount) || student.discount || 0);
      
      // Auto-update training fee status after total fee change
      const currentPaidAmount = student.paidAmount || 0;
      const currentFinalFee = student.finalFee || 0;
      
      if (currentPaidAmount >= currentFinalFee) {
        student.trainingFeeStatus = "full paid";
        student.tnxStatus = "full paid";
      } else if (currentPaidAmount > 0) {
        student.trainingFeeStatus = "partial";
        student.tnxStatus = "paid";
      } else {
        student.trainingFeeStatus = "pending";
        student.tnxStatus = "pending";
      }
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
      student.dueAmount = Math.max(student.finalFee - student.paidAmount, 0);
      
      // Auto-update training fee status after technology change
      const currentPaidAmount = student.paidAmount || 0;
      const currentFinalFee = student.finalFee || 0;
      
      if (currentPaidAmount >= currentFinalFee) {
        student.trainingFeeStatus = "full paid";
        student.tnxStatus = "full paid";
      } else if (currentPaidAmount > 0) {
        student.trainingFeeStatus = "partial";
        student.tnxStatus = "paid";
      } else {
        student.trainingFeeStatus = "pending";
        student.tnxStatus = "pending";
      }
    }

    if (nextDueDate !== undefined) {
      student.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    }
    if (dueRemark !== undefined) {
      student.dueRemark = dueRemark;
    }

    // Save the updated student
    await student.save();
    await syncRegistrationFees(student._id);

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

    // Find the existing student
    const student = await Registration.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Build update object
    const updateData = {};
    if (status) updateData.status = status;
    updateData.verifiedBy = user._id;

    if (status === "accepted") {
      // 1. Automatically accept all registration / initial fee records for this student
      await Fee.updateMany(
        { registrationId: id, status: { $in: ["new", "rejected", "pending"] } },
        { status: "accepted", tnxStatus: "paid", verifiedBy: user._id }
      );

      // 2. Fetch all accepted fee records for this student and sum them up
      const acceptedFees = await Fee.find({ registrationId: id, status: "accepted" });
      const totalPaid = acceptedFees.reduce((sum, f) => sum + (f.amount || 0), 0);

      updateData.paidAmount = totalPaid;
      updateData.dueAmount = Math.max((student.finalFee || 0) - totalPaid, 0);
      updateData.trainingFeeStatus = totalPaid >= (student.finalFee || 0) ? "full paid" : (totalPaid > 0 ? "partial" : "pending");
      updateData.tnxStatus = totalPaid >= (student.finalFee || 0) ? "full paid" : "paid";
    }

    if (status === "rejected") {
      // Reject related Fee records
      await Fee.updateMany(
        { registrationId: id },
        { status: "rejected", tnxStatus: "failed" }
      );
      updateData.tnxStatus = "failed";
      updateData.trainingFeeStatus = "pending";
      updateData.paidAmount = 0;
      updateData.dueAmount = student.finalFee || 0;
    }

    const updatedRegistration = await Registration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    );

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

// Toggle Cancel Registration Status
export const toggleCancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { isCancelled } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Registration ID is required",
      });
    }

    const student = await Registration.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    student.isCancelled = isCancelled === true || isCancelled === "true";
    await student.save();

    res.status(200).json({
      success: true,
      message: `Registration ${student.isCancelled ? "cancelled" : "activated"} successfully`,
      data: student,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error toggling cancel registration",
      error: error.message,
    });
  }
};

// Update certificate status

// Update join status
export const updateJoinStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isJoin } = req.body;

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

    const student = await Registration.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    const updateData = {
      isJoin: !!isJoin,
    };

    if (isJoin && !student.joiningData) {
      updateData.joiningData = Date.now();
    }

    const updatedRegistration = await Registration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Training join status updated successfully",
      data: updatedRegistration,
    });
  } catch (error) {
    console.error("Update join status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating join status",
      error: error.message,
    });
  }
};

export const updateCertificateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { certificateIssued } = req.body;
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

    // Find the existing student
    const student = await Registration.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Build update object
    const updateData = {
      certificateIssued: !!certificateIssued
    };

    if (certificateIssued) {
      updateData.isJoin = true;
      updateData.joiningData = Date.now();
    }

    const updatedRegistration = await Registration.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Certificate status updated successfully",
      data: updatedRegistration,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating certificate status",
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
    const { userid, latitude, longitude } = req.body;

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

    const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'Unknown';
    const userAgent = req.get('User-Agent') || 'Unknown';
    const location = await getLocationFromIP(userIP);
    if (latitude && longitude) {
      location.lat = latitude;
      location.lon = longitude;
      location.mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

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

        <div style="background-color: #f8f9fa; border: 1px solid #eeeeee; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: left;">
          <h4 style="margin: 0 0 10px 0; color: #333333; font-size: 14px; border-bottom: 1px solid #eeeeee; padding-bottom: 5px;">Security Details:</h4>
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #555555; line-height: 1.5;">
            <tr>
              <td style="padding: 3px 0; font-weight: bold; width: 30%;">IP Address:</td>
              <td style="padding: 3px 0;">${userIP}</td>
            </tr>
            <tr>
              <td style="padding: 3px 0; font-weight: bold;">Location:</td>
              <td style="padding: 3px 0;">${location.text || 'Unknown'}</td>
            </tr>
            ${location.lat ? `
            <tr>
              <td style="padding: 3px 0; font-weight: bold;">Coordinates:</td>
              <td style="padding: 3px 0;">
                <a href="${location.mapsLink}" target="_blank" style="color: #0d6efd; text-decoration: underline; font-weight: bold;">
                  ${location.lat}, ${location.lon} (Click to View on Google Maps)
                </a>
              </td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 3px 0; font-weight: bold;">Device:</td>
              <td style="padding: 3px 0; font-size: 11px;">${userAgent}</td>
            </tr>
          </table>
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

    console.log('🔍 OTP Verification Request:', { otp, userid });

    if (!otp || !userid) {
      return res.status(400).json({
        success: false,
        message: "OTP and userid are required",
      });
    }

    const student = await Registration.findById(userid);

    if (!student) {
      console.log('❌ Student not found for userid:', userid);
      return res.status(404).json({
        success: false,
        message: "Invalid user",
      });
    }

    console.log('🔍 Student found:', {
      userid: student.userid,
      mobile: student.mobile,
      storedOtp: student.otp,
      otpExpire: student.otpExpire,
      currentTime: new Date()
    });

    // ❌ OTP not generated or already used
    if (!student.otp) {
      console.log('❌ No OTP found or already used');
      return res.status(400).json({
        success: false,
        message: "OTP expired or already verified",
      });
    }

    // ❌ OTP expired
    if (student.otpExpire && new Date(student.otpExpire) < new Date()) {
      console.log('❌ OTP expired:', { otpExpire: student.otpExpire, now: new Date() });
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
      console.log('❌ OTP mismatch:', { stored: student.otp, provided: otp });
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    console.log('✅ OTP verified successfully');

    // 🔐 Single device login: Clear any existing session before creating new one
    if (student.currentSessionToken) {
      console.log(`Student ${student.userid} logging in via OTP from new device - invalidating previous session`);
    }
    
    // ✅ OTP verified → clear OTP and update login tracking
    student.otp = null;
    student.otpExpire = null;
    student.isLogin = true;
    student.loginAt = new Date();
    student.logoutAt = null;
    
    // Store device information  
    const userAgent = req.get('User-Agent') || 'Unknown';
    const userIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0] || 'Unknown';
    
    student.lastLoginDevice = {
      userAgent: userAgent,
      ip: userIP,
      loginTime: new Date()
    };
    
    // 🔐 Generate JWT token (this will automatically update currentSessionToken and invalidate old sessions)
    const accessToken = await student.generateToken();
    
    // Save student with new session token
    await student.save();

    // Set secure cookie with proper configuration
    const cookieMaxAge = parseInt(process.env.COOKIE_EXPIRE) || 30 * 24 * 60 * 60 * 1000; // 30 days default
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // true in production
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // none for cross-origin in production
      maxAge: cookieMaxAge,
    });

    console.log('✅ Login successful, token generated');

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      userId: student._id,
      user: {
        id: student._id,
        userid: student.userid,
        name: student.studentName,
        email: student.email,
        mobile: student.mobile,
        role: 'student',
        branch: student.branch,
        isPasswordSet: student.isPasswordSet
      },
      accessToken,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message,
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
// Get user data by mobile number or student ID
export const getUserData = async (req, res) => {
  try {
    const { identifier } = req.params; // mobile number ya student ID

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Mobile number ya Student ID provide karo"
      });
    }

    // Search by mobile number or student ID
    const user = await Registration.findOne({
      $or: [
        { mobile: identifier },
        { userid: identifier }
      ]
    })
    .select("-password -otp -otpExpire")
    .populate("training", "name duration")
    .populate("technology", "name price")
    .populate("education", "name")
    .populate("branch", "name address")
    .populate("hrName", "name email phone")
    .populate("collegeName", "name district")
    .populate("batch", "batchName startDate endDate")
    .populate("tag", "name")
    .populate("qrcode", "name upi")
    .populate("registeredBy", "name email")
    .populate("verifiedBy", "name email");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User nahi mila is mobile number ya student ID se"
      });
    }

    return res.status(200).json({
      success: true,
      message: "User data successfully fetch kiya gaya",
      data: user
    });

  } catch (error) {
    console.error("Error fetching user data:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

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

export const RegistrationByWebDirect = async (req, res) => {
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
      paymentType,
      gender,
      hrName,
      amount,
      tnxId,
      paymentMethod,
    } = req.body;

    const files = req.files || {};
    let imageUrl = null;
    if (files.image && files.image[0]) {
      imageUrl = `/uploads/${files.image[0].filename}`;
    }

    // Get technology price
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
    const safePaymentType = paymentType || "registration";
    if (!["registration", "full"].includes(safePaymentType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment type. Use 'registration' or 'full'",
      });
    }

    // Create new registration
    // We leave 'amount' undefined in the new Registration document.
    // This allows it to successfully bypass Mongoose's validation min: 500 constraint.
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
      amount: amount ? Number(amount) : undefined,
      tnxId,
      image: imageUrl,
      status: "new",
      paidAmount: paymentMethod === "online" ? 0 : (amount ? Number(amount) : 0),
      dueAmount: finalFee - (paymentMethod === "online" ? 0 : (amount ? Number(amount) : 0)),
      tnxStatus: "pending",
      trainingFeeStatus: "pending",
      paymentType: safePaymentType,
      paymentMethod: paymentMethod || "cash",
      gender,
      hrName,
    });

    const savedRegistration = await newRegistration.save();

    let razorpayOrder = null;
    if (paymentMethod === "online" && razorpay) {
      razorpayOrder = await razorpay.orders.create({
        amount: Number(amount) * 100, // paise
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
        paidAmount: paymentMethod === "online" ? 0 : Number(amount),
        dueAmount: finalFee - (paymentMethod === "online" ? 0 : Number(amount)),
        amount: Number(amount),
        paymentType: safePaymentType,
        mode: paymentMethod, // Pass mode to Fee
        status: "new",
        tnxStatus: "pending",
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

    // Send confirmations for direct/offline registration
    if (paymentMethod !== "online") {
      try {
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
            discount: populatedRegistration.discount || 0,
            finalFee: populatedRegistration.finalFee,
            paidAmount: populatedRegistration.paidAmount,
            dueAmount: populatedRegistration.dueAmount,
            mobile: populatedRegistration.mobile,
          });
        }
      } catch (notifyErr) {
        console.error("Failed to send notification for direct registration:", notifyErr);
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

// Send OTP for student data export
export const sendExportOtp = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`🔐 Export OTP generated for ${user.email}: ${otp}`);
    user.otp = otp;
    user.otpExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await user.save();

    // 📧 Send Emails in the background
    const handleBackgroundExportOtp = async () => {
      try {
        if (user.role === "Super Admin") {
          const superAdminEmails = [
            "digicoderstech@gmail.com", 
            "digitalgurucse@gmail.com",
            "Kashyapaditya2781@gmail.com"
          ];
          for (const email of superAdminEmails) {
            try {
              await sendExportOTPEmail(email, { otp });
            } catch (err) {
              console.error(`Error sending export OTP to ${email}:`, err);
            }
          }
          console.log(`🔐 Super Admin Export OTP ${otp} sent to security emails`);
        } else {
          if (user.email) {
            await sendExportOTPEmail(user.email, { otp });
          }
        }
      } catch (err) {
        console.error("Error in sending export OTP email:", err);
      }
    };

    handleBackgroundExportOtp();

    return res.status(200).json({
      success: true,
      message: user.role === "Super Admin"
        ? "Export OTP sent to security team emails."
        : `Export OTP sent to your registered email (${user.email}).`,
      otp: process.env.NODE_ENV === "development" ? otp : undefined
    });
  } catch (error) {
    console.error("Send export OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// Verify OTP and return the student data for export
// @desc    Verify student token and get current student info
// @route   GET /api/registration/me
// @access  Private (Student)
export const getMe = async (req, res) => {
  try {
    if (!req.student) {
      return res.status(404).json({
        success: false,
        message: "Student session not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student session verified",
      user: {
        id: req.student._id,
        userid: req.student.userid,
        name: req.student.studentName,
        email: req.student.email,
        mobile: req.student.mobile,
        role: 'student',
        branch: req.student.branch,
        isPasswordSet: req.student.isPasswordSet
      },
    });
  } catch (error) {
    console.error("Get student me error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Student logout
// @route   POST /api/registration/logout
// @access  Private (Student)
export const logout = async (req, res) => {
  try {
    // Update logout tracking if student is logged in
    if (req.student) {
      req.student.isLogin = false;
      req.student.logoutAt = new Date();
      req.student.currentSessionToken = null; // Clear current session
      await req.student.save();
    }

    // Clear cookie
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Student logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

export const verifyExportOtpAndFetchData = async (req, res) => {
  try {
    const { otp, branch, technologies, status, educations, colleges, hasDue, certificateIssued, isJoin, isCancelled } = req.body;
    console.log("🔍 [DEBUG verify] Body received:", { otp, branch, technologies, status, educations, colleges, hasDue, certificateIssued, isJoin, isCancelled });
    console.log("🔍 [DEBUG verify] Logged-in user from token:", req.user?._id);

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide OTP"
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      console.log("🔍 [DEBUG verify] User NOT found in DB");
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("🔍 [DEBUG verify] DB User Details:", {
      id: user._id,
      email: user.email,
      otp: user.otp,
      otpExpire: user.otpExpire,
      otpMatch: user.otp === otp,
      expired: user.otpExpire ? new Date(user.otpExpire) < new Date() : true
    });

    // Verify OTP
    if (!user.otp || user.otp !== otp || new Date(user.otpExpire) < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

    // Clear OTP
    user.otp = undefined;
    user.otpExpire = undefined;
    await user.save();

    if (req.body.onlyVerify) {
      return res.status(200).json({
        success: true,
        message: "OTP verified successfully"
      });
    }

    // Now fetch the data
    const filter = {};

    // Cancelled filter support
    if (isCancelled === 'true' || isCancelled === true) {
      filter.isCancelled = true;
    } else {
      filter.isCancelled = { $ne: true };
    }

    if (status) {
      if (status !== "all") {
        filter.status = status;
      }
    } else {
      filter.status = "accepted"; // Default to accepted for backward compatibility
    }

    if (hasDue === true || hasDue === 'true') {
      filter.dueAmount = { $gt: 0 };
    }
    
    if (certificateIssued !== undefined) {
      if (certificateIssued === true || certificateIssued === 'true') {
        filter.certificateIssued = true;
      } else if (certificateIssued === false || certificateIssued === 'false') {
        filter.certificateIssued = { $ne: true };
      }
    }

    if (isJoin !== undefined) {
      if (isJoin === true || isJoin === 'true') {
        filter.isJoin = true;
      } else if (isJoin === false || isJoin === 'false') {
        filter.isJoin = { $ne: true };
      }
    }

    // Branch restriction logic (just like in getAllRegistrations)
    if (user.role !== "Super Admin") {
      filter.branch = new mongoose.Types.ObjectId(user.branch);
    } else {
      if (branch && branch !== "All") {
        filter.branch = new mongoose.Types.ObjectId(branch);
      }
    }

    // Technology filtering (multiple selection support)
    if (technologies && Array.isArray(technologies) && technologies.length > 0) {
      filter.technology = { $in: technologies.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Education filtering (multiple selection support)
    if (educations && Array.isArray(educations) && educations.length > 0) {
      filter.education = { $in: educations.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // College filtering (multiple selection support)
    if (colleges && Array.isArray(colleges) && colleges.length > 0) {
      filter.collegeName = { $in: colleges.map(id => new mongoose.Types.ObjectId(id)) };
    }

    console.log("🔍 [DEBUG verify] Querying registrations with filter:", filter);
    // Fetch and populate registration data
    const students = await Registration.find(filter)
      .select("-password")
      .populate("training", "name duration")
      .populate("technology", "name price duration")
      .populate("education", "name")
      .populate("registeredBy", "name email")
      .populate("verifiedBy", "name email")
      .populate("branch", "name address")
      .populate("qrcode", "name image")
      .populate("hrName", "name email mobile")
      .populate("tag", "name")
      .populate("collegeName", "name district")
      .populate("batch", "batchName startDate endDate")
      .sort({ createdAt: -1 })
      .lean();

    console.log("🔍 [DEBUG verify] Query completed, found count:", students.length);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully. Exporting data...",
      data: students
    });
  } catch (error) {
    console.error("Verify export OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

export const checkOldStudentStatus = async (req, res) => {
  try {
    const { mobile } = req.params;
    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    const student = await Registration.findOne({
      mobile: mobile.trim(),
      status: "accepted",
      isCancelled: { $ne: true },
      trainingFeeStatus: "full paid",
    });

    if (student) {
      return res.status(200).json({
        success: true,
        isOldStudent: true,
        studentName: student.studentName,
      });
    }

    return res.status(200).json({
      success: true,
      isOldStudent: false,
    });
  } catch (error) {
    console.error("Error in checkOldStudentStatus:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

