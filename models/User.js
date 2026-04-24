// import mongoose from "mongoose";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import crypto from "crypto";
// import dotenv from "dotenv";

// const userSchema = new mongoose.Schema(
//   {
//     name: {
//       type: String,
//       required: [true, "Name is required"],
//       trim: true,
//       maxlength: [50, "Name cannot exceed 50 characters"],
//     },
//     email: {
//       type: String,
//       required: [true, "Email is required"],
//       unique: true,
//       lowercase: true,
//       match: [
//         /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
//         "Please enter a valid email",
//       ],
//     },
//     phone: {
//       type: String,
//       match: [/^[6-9]\d{9}$/, "Please enter a valid mobile number"],
//     },
//     password: {
//       type: String,
//       required: [true, "Password is required"],
//       minlength: [6, "Password must be at least 6 characters"],
//     },
//     // role:{
//     //   type:String,
//     //   enum: ["Admin", "Employee","Intern"],
//     //     default: "Admin",
//     // },
//     role: {
//       type: String,
//       enum: ["Super Admin", "Admin", "Employee"],
//       default: "Employee",
//     },
//     // branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
//     branch: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Branch",
//       required: function () {
//         return this.role === "Admin" || this.role === "Employee";
//       },
//     },
//     image: {
//       url: { type: String },
//       public_id: { type: String },
//     },
//     registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
//     isTwoFactor: {
//       type: Boolean,
//       default: false,
//     },
//     otp: String,
//     isActive: {
//       type: Boolean,
//       default: true,
//     },
//     isVerified: {
//       type: Boolean,
//       default: false,
//     },
//     address: String,
//     post: String,
//     verificationToken: String,
//     verificationTokenExpire: Date,
//     resetPasswordToken: String,
//     resetPasswordExpire: Date,
//     lastLogin: Date,
//     loginAttempts: {
//       type: Number,
//       default: 0,
//     },
//     lockUntil: Date,
//      isSuperAdmin: {
//     type: Boolean,
//     default: false
//   }
//   },
//   {
//     timestamps: true,
//   }
// );
// dotenv.config();
// // Indexes
// userSchema.index({ role: 1, branch: 1 });
// userSchema.index({ email: 1 }, { unique: true });
// // Virtuals
// userSchema.virtual('isLocked').get(function() {
//   return !!(this.lockUntil && this.lockUntil > Date.now());
// });

// // Pre-save middleware
// userSchema.pre('save', async function(next) {
//   // Set Super Admin
//   if (this.role === "Super Admin") {
//     this.isSuperAdmin = true;
//     this.branch = undefined; // Super Admin has no branch
//   }

//   if (!this.isModified('password')) return next();
//   this.password = await bcrypt.hash(this.password, 12);
//   next();
// });

// // // Pre-save middleware to hash password
// // userSchema.pre("save", async function (next) {
// //   if (!this.isModified("password")) return next();

// //   this.password = await bcrypt.hash(this.password, 12);
// //   next();
// // });

// // Methods
// userSchema.methods.comparePassword = async function(candidatePassword) {
//   return await bcrypt.compare(candidatePassword, this.password);
// };

// userSchema.methods.generateToken = function() {
//   return jwt.sign(
//     { 
//       id: this._id, 
//       email: this.email, 
//       role: this.role,
//       isSuperAdmin: this.isSuperAdmin,
//       branch: this.branch 
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: process.env.JWT_EXPIRE }
//   );
// };


// // Generate JWT token
// // userSchema.methods.generateToken = function () {
// //   return jwt.sign(
// //     { id: this._id, email: this.email, role: this.role },
// //     process.env.JWT_SECRET,
// //     { expiresIn: process.env.JWT_EXPIRE }
// //   );
// // };
// // Static method to create first Super Admin
// userSchema.statics.createSuperAdmin = async function(data) {
//   const existingSuperAdmin = await this.findOne({ role: "Super Admin" });
//   if (existingSuperAdmin) {
//     throw new Error("Super Admin already exists");
//   }

//   const superAdmin = new this({
//     ...data,
//     role: "Super Admin",
//     isVerified: true,
//     isActive: true
//   });

//   return await superAdmin.save();
// };
// // Generate email verification token
// // userSchema.methods.generateVerificationToken = function () {
// //   const verificationToken = crypto.randomBytes(32).toString("hex");
// //   this.verificationToken = crypto
// //     .createHash("sha256")
// //     .update(verificationToken)
// //     .digest("hex");
// //   this.verificationTokenExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
// //   return verificationToken;
// // };

// // Handle login attempts
// // userSchema.methods.incLoginAttempts = function () {
// //   if (this.lockUntil && this.lockUntil < Date.now()) {
// //     return this.updateOne({
// //       $unset: { loginAttempts: 1, lockUntil: 1 },
// //     });
// //   }

// //   const updates = { $inc: { loginAttempts: 1 } };
// //   if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
// //     updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
// //   }

// //   return this.updateOne(updates);
// // };

// export default mongoose.model("User", userSchema);

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phone: {
      type: String,
      match: [/^[6-9]\d{9}$/, "Please enter a valid mobile number"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    role: {
      type: String,
      enum: ["Super Admin", "Admin", "Employee"],
      default: "Employee",
      required: true,
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: function () {
        return this.role === "Admin" || this.role === "Employee";
      },
    },
    image: {
      url: { type: String },
      public_id: { type: String },
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    address: String,
    isTwoFactor: {
      type: Boolean,
      default: false,
    },
    otp: String,
    otpExpire: String,
    // Virtual field to check if locked
    isLocked: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for checking lock status
userSchema.virtual('isAccountLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Indexes
userSchema.index({ role: 1, branch: 1 });
userSchema.index({ email: 1 }, { unique: true });

// Pre-save middleware
userSchema.pre('save', async function (next) {
  // Only hash password if modified
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      branch: this.branch
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Handle login attempts
userSchema.methods.incLoginAttempts = async function () {
  this.loginAttempts += 1;

  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
  }

  return await this.save();
};

// Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  return await this.save();
};

export default mongoose.model("User", userSchema);