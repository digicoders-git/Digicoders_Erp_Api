import Company from "../models/company.js";
import asyncHandler from "express-async-handler";

// @desc    Get all companies with filtering, searching, sorting and pagination
// @route   GET /api/companies
// @access  Private
const getCompanies = asyncHandler(async (req, res) => {
  const { 
    search, 
    industry,
    isActive,
    contactPersonName,
    email,
    phone,
    sortBy = "createdAt", 
    sortOrder = "desc",
    page = 1,
    limit = 10
  } = req.query;

  // Build filter object
  const filter = {};

  // Search filter
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { industry: { $regex: search, $options: "i" } },
      { contactPersonName: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
      { city: { $regex: search, $options: "i" } },
      { state: { $regex: search, $options: "i" } }
    ];
  }

  // Industry filter
  if (industry && industry !== "All") {
    filter.industry = industry;
  }

  // Contact Person filter
  if (contactPersonName && contactPersonName !== "All") {
    filter.contactPersonName = contactPersonName;
  }

  // Email filter
  if (email && email !== "All") {
    filter.email = email;
  }

  // Phone filter
  if (phone && phone !== "All") {
    filter.$or = [
      { phone: phone },
      { mobile: phone }
    ];
  }

  // Active status filter
  if (isActive !== undefined && isActive !== "All") {
    filter.isActive = isActive === "true";
  }

  // Sorting
  const sortOptions = {};
  const allowedSortFields = [
    "name", "email", "industry", "contactPersonName", "phone", 
    "isActive", "createdAt", "updatedAt"
  ];
  
  // Validate sort field
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

  // Calculate pagination
  const pageNumber = parseInt(page);
  const limitNumber = parseInt(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Get total count for pagination
  const total = await Company.countDocuments(filter);

  // Query with pagination
  const companies = await Company.find(filter)
    .populate("createdBy", "name email")
    .sort(sortOptions)
    .skip(skip)
    .limit(limitNumber);

  res.status(200).json({
    success: true,
    message: "Companies fetched successfully",
    count: companies.length,
    total,
    page: pageNumber,
    pages: Math.ceil(total / limitNumber),
    data: companies.map((company) => company.getDetails()),
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      total,
      pages: Math.ceil(total / limitNumber),
    },
  });
});

// @desc    Get single company
// @route   GET /api/companies/:id
// @access  Private
const getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id).populate(
    "createdBy",
    "name email"
  );

  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  res.status(200).json({
    success: true,
    message: "Company fetched successfully",
    data: company.getDetails(),
  });
});

// @desc    Create new company
// @route   POST /api/companies
// @access  Private
const createCompany = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone,
    mobile,
    contactNumber,
    contactPersonName,
    address,
    city,
    state,
    website,
    industry,
    description,
  } = req.body;

  // Check if company already exists
  const companyExists = await Company.findOne({ email });
  if (companyExists) {
    res.status(400);
    throw new Error("Company with this email already exists");
  }

  // Create company
  const company = await Company.create({
    name,
    email,
    phone,
    mobile,
    contactNumber,
    contactPersonName,
    address,
    city,
    state,
    website,
    industry,
    description,
    createdBy: req.user.id,
  });

  res.status(201).json({
    success: true,
    message: "Company created successfully",
    data: company.getDetails(),
  });
});

// @desc    Update company
// @route   PUT /api/companies/:id
// @access  Private
const updateCompany = asyncHandler(async (req, res) => {
  let company = await Company.findById(req.params.id);

  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  // Check if email is being changed and if it already exists
  if (req.body.email && req.body.email !== company.email) {
    const companyExists = await Company.findOne({ email: req.body.email });
    if (companyExists) {
      res.status(400);
      throw new Error("Company with this email already exists");
    }
  }

  company = await Company.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate("createdBy", "name email");

  res.status(200).json({
    success: true,
    message: "Company updated successfully",
    data: company.getDetails(),
  });
});

// @desc    Delete company
// @route   DELETE /api/companies/:id
// @access  Private
const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  await Company.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Company deleted successfully",
    data: {},
  });
});

// @desc    Toggle company status
// @route   PATCH /api/companies/:id
// @access  Private
const toggleCompanyStatus = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);

  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  company.isActive = !company.isActive;
  await company.save();

  res.status(200).json({
    success: true,
    message: `Company ${company.isActive ? "activated" : "deactivated"} successfully`,
    data: company.getDetails(),
  });
});

// @desc    Get company statistics
// @route   GET /api/companies/stats/overview
// @access  Private
const getCompanyStats = asyncHandler(async (req, res) => {
  const totalCompanies = await Company.countDocuments();
  const activeCompanies = await Company.countDocuments({ isActive: true });
  const companiesByIndustry = await Company.aggregate([
    { $group: { _id: "$industry", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    message: "Company statistics fetched successfully",
    data: {
      totalCompanies,
      activeCompanies,
      inactiveCompanies: totalCompanies - activeCompanies,
      companiesByIndustry,
    },
  });
});

export {
  getCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
  toggleCompanyStatus,
  getCompanyStats,
};