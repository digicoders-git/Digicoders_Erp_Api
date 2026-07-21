import Hr from "../models/manageHr.js";
import Registration from "../models/regsitration.js";

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
      data: hr,
    });
  } catch (error) {
    console.error("Error creating HR:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const getAllHr = async (req, res) => {
  try {
    const {
      search,
      branch,
      isActive,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 1000,
    } = req.query;

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { personalNo: { $regex: search, $options: "i" } },
        { officeNo: { $regex: search, $options: "i" } },
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

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = limit === "all" ? 0 : parseInt(limit);
    const skip = limitNumber === 0 ? 0 : (pageNumber - 1) * limitNumber;

    // Fields that exist in the HR document itself
    const dbSortFields = ["name", "personalNo", "officeNo", "isActive", "createdAt", "updatedAt"];
    // Fields that are computed via aggregation
    const aggregationSortFields = ["registrationCount"];

    const isAggregationSort = aggregationSortFields.includes(sortBy);
    const sortField = dbSortFields.includes(sortBy) ? sortBy : isAggregationSort ? sortBy : "createdAt";

    const sortOptions = {};
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Use aggregation to include registration count
    const pipeline = [
      { $match: filter },
      {
        $lookup: {
          from: "registrations",
          localField: "_id",
          foreignField: "hrName",
          as: "registrations",
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "branch",
          foreignField: "_id",
          as: "branch",
        },
      },
      {
        $unwind: {
          path: "$branch",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          registrationCount: { $size: "$registrations" },
        },
      },
      {
        $project: {
          registrations: 0,
          __v: 0,
        },
      },
      // Sort AFTER addFields so registrationCount is available for sorting
      { $sort: sortOptions },
      { $skip: skip },
    ];

    if (limitNumber > 0) {
      pipeline.push({ $limit: limitNumber });
    }

    // Get total count for pagination
    const totalCount = await Hr.countDocuments(filter);
    const hr = await Hr.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      message: "Successfully fetched HR data",
      count: hr.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / (limitNumber || totalCount || 1)),
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

// New: Get HR performance details (monthly chart + training type breakdown + student list)
export const getHrPerformance = async (req, res) => {
  try {
    const { id } = req.params;

    // Check HR exists
    const hr = await Hr.findById(id).populate("branch", "name");
    if (!hr) {
      return res.status(404).json({ success: false, message: "HR not found" });
    }

    // All registrations for this HR
    const registrations = await Registration.find({ hrName: id })
      .populate("training", "name")
      .populate("technology", "name")
      .populate("branch", "name")
      .populate("hrName", "name")
      .select(
        "studentName mobile training technology branch hrName status createdAt registrationType paidAmount finalFee trainingFeeStatus"
      )
      .sort({ createdAt: -1 });

    // Monthly breakdown (last 12 months)
    const now = new Date();
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("default", {
        month: "short",
        year: "2-digit",
      });
      const count = registrations.filter((r) => {
        const rd = new Date(r.createdAt);
        return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
      }).length;
      monthlyData.push({ month: label, count });
    }

    // Training type breakdown
    const trainingBreakdown = {};
    registrations.forEach((r) => {
      const trainingName = r.training?.name || "Unknown";
      trainingBreakdown[trainingName] = (trainingBreakdown[trainingName] || 0) + 1;
    });

    const trainingStats = Object.entries(trainingBreakdown).map(([name, count]) => ({
      name,
      count,
    }));

    // Status breakdown
    const statusBreakdown = {};
    registrations.forEach((r) => {
      const s = r.status || "unknown";
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      data: {
        hr: {
          _id: hr._id,
          name: hr.name,
          branch: hr.branch,
          personalNo: hr.personalNo,
          officeNo: hr.officeNo,
          isActive: hr.isActive,
        },
        totalRegistrations: registrations.length,
        monthlyData,
        trainingStats,
        statusBreakdown,
        registrations,
      },
    });
  } catch (error) {
    console.error("Error fetching HR performance:", error);
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
