import ExpressMongoSanitize from "express-mongo-sanitize";
import Hr from "../models/manageHr.js";

export const createHr = async (req, res) => {
  try {
    const { name, branch, personalNo, officeNo } = req.body;

    // Required fields check
    if (!name || !branch) {
      return res.status(400).json({
        success: false,
        message: "Name and Branch are required",
      });
    }

    const hr = await Hr.create({ name, branch, personalNo, officeNo });

    return res.status(201).json({
      success: true,
      message: "HR created successfully!",
      data: hr, // created HR object return karo
    });
  } catch (error) {
    console.error("Error creating HR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// export const getAllHr = async (req, res) => {
//   try {
//     const hr = await Hr.find().populate("branch","name");
//     return res
//       .status(200)
//       .json({ message: "successfull", data: hr, success: true });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "internal server error", error, success: false });
//   }
// };
export const getAllHr = async (req, res) => {
  try {
    const { 
      search, 
      branch,
      isActive, 
      sortBy = "createdAt", 
      sortOrder = "desc",
      page = 1,
      limit = 1000
    } = req.query;

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { personalNo: { $regex: search, $options: "i" } },
        { officeNo: { $regex: search, $options: "i" } }
      ];
    }

    // Branch filter
    if (branch && branch !== "All") {
      filter.branch = branch;
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    // Sorting
    const sortOptions = {};
    const allowedSortFields = [
      "name", "personalNo", "officeNo", "isActive", "createdAt", "updatedAt"
    ];
    
    // Validate sort field
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = limit === "all" ? 0 : parseInt(limit);
    const skip = limitNumber === 0 ? 0 : (pageNumber - 1) * limitNumber;

    // Get total count for pagination
    const totalCount = await Hr.countDocuments(filter);

    // Query with pagination and populate
    const query = Hr.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .populate("branch", "name isActive")
      .select("-__v");

    if (limitNumber > 0) query.limit(limitNumber);

    const hr = await query;

    return res.status(200).json({
      success: true,
      message: "Successfully fetched HR data",
      count: hr.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / limitNumber),
      data: hr,
    });
  } catch (error) {
    console.error("Error fetching HR data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
export const updataHr = async (req, res) => {
  try {
    const { name, isActive, branch, personalNo, officeNo } = req.body;
    const hr = await Hr.findById(req.params.id);
    if (!hr)
      return res.status(404).json({ message: "hr not found", success: false });
    if (typeof isActive !== "undefined") hr.isActive = isActive;
    if (name) hr.name = name;
    if (branch) hr.branch = branch;
    if (personalNo) hr.personalNo = personalNo;
    if (officeNo) hr.officeNo = officeNo;
    await hr.save();
    return res
      .status(200)
      .json({ message: "Hr updated successfull", success: true });
  } catch (error) {
    // Mongoose validation error (e.g. invalid phone number)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(", ") });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const deletaHr = async (req, res) => {
  try {
    const hr = await Hr.findByIdAndDelete(req.params.id);
    if (!hr)
      return res
        .status(404)
        .json({ message: "Hr deleting faild!", success: false });
    return res
      .status(200)
      .json({ message: "Hr deleted successfull ", success: true });
  } catch (error) {
    res.status(500).json({ message: "internal server error", success: false });
  }
};
