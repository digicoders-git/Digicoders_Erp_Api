// import College from "../models/college.js";

// // Get college names for datalist
// export const getCollegeNames = async (req, res) => {
//   try {
//     const colleges = await College.find();

//     return res.status(200).json({
//       success: true,
//       colleges,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error fetching college names",
//       error: error.message,
//     });
//   }
// };

// // Add new college name
// export const addCollegeName = async (req, res) => {
//   try {
//     const { name } = req.body;

//     if (!name) {
//       return res.status(400).json({
//         success: false,
//         message: "College name is required",
//       });
//     }

//     const newCollege = await College.create({ name: name ,addedBy:req.user._id });

//     res.status(201).json({
//       success: true,
//       message: "College name added successfully",
//     });
//   } catch (error) {
//     if (error.code === 11000) {
//       return res.status(400).json({
//         success: false,
//         message: "College name already exists",
//       });
//     }
//     res.status(500).json({
//       success: false,
//       message: "Error adding college name",
//       error: error.message,
//     });
//   }
// };
// export const updataCollage = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { 
//       isActive, 
//       name, 
//       district, 
//       state, 
//       address, 
//       course, 
//       tpoNo1, 
//       tpoNo2, 
//       hodNo 
//     } = req.body;
    
//     if (!id) {
//       return res.status(400).json({ 
//         message: "ID is required", 
//         success: false 
//       });
//     }
    
//     const collage = await College.findById(id);
//     if (!collage) {
//       return res.status(404).json({ 
//         message: "College data not found", 
//         success: false 
//       });
//     }
    
//     // Update all provided fields
//     if (name) collage.name = name;
//     if (typeof isActive !== "undefined") collage.isActive = isActive;
//     if (district !== undefined) collage.district = district;
//     if (state !== undefined) collage.state = state;
//     if (address !== undefined) collage.address = address;
//     if (course !== undefined) collage.course = course;
//     if (tpoNo1 !== undefined) collage.tpoNo1 = tpoNo1;
//     if (tpoNo2 !== undefined) collage.tpoNo2 = tpoNo2;
//     if (hodNo !== undefined) collage.hodNo = hodNo;
    
//     await collage.save();
    
//     return res.status(200).json({ 
//       message: "Update successful", 
//       success: true,
//       college: collage 
//     });
//   } catch (error) {
//     console.error("Error updating college:", error);
    
//     // Handle duplicate key error (unique name constraint)
//     if (error.code === 11000) {
//       return res.status(400).json({ 
//         message: "College name already exists", 
//         success: false 
//       });
//     }
    
//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       const errors = Object.values(error.errors).map(err => err.message);
//       return res.status(400).json({ 
//         message: "Validation error", 
//         errors: errors,
//         success: false 
//       });
//     }
    
//     return res.status(500).json({ 
//       message: "Error updating college details", 
//       success: false 
//     });
//   }
// };

// export const deleteCollage=async (req,res) => {
//   try {
//     const collage= await College.findByIdAndDelete(req.params.id)
//     if(!collage) return res.status(404).json({message:"data not found",success: false,})
//       return res.status(200).json({message:"data deleted successfull",success: true,})
//   } catch (error) {
//     res.status(500).json({message:"Error deleteing college detels",error,success: false,})
//   }
// }


import College from "../models/college.js";

// Get all colleges with optional filtering
export const getAllColleges = async (req, res) => {
  try {
    const { 
      search, 
      state, 
      district, 
      course,
      isActive, 
      sortBy = "createdAt", 
      sortOrder = "desc",
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    // Search filter
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { district: { $regex: search, $options: "i" } },
        { state: { $regex: search, $options: "i" } },
        { course: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { tpoNo1: { $regex: search, $options: "i" } },
        { tpoNo2: { $regex: search, $options: "i" } },
        { hodNo: { $regex: search, $options: "i" } }
      ];
    }

    // State filter
    if (state && state !== "All") {
      filter.state = state;
    }

    // District filter
    if (district && district !== "All") {
      filter.district = district;
    }

    // Course filter
    if (course && course !== "All") {
      filter.course = course;
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    // Sorting
    const sortOptions = {};
    const allowedSortFields = [
      "name", "state", "district", "course", "address", 
      "tpoNo1", "tpoNo2", "hodNo", "isActive", "createdAt", "updatedAt"
    ];
    
    // Validate sort field
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count for pagination
    const totalCount = await College.countDocuments(filter);

    // Query with pagination
    const colleges = await College.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber)
      .populate("addedBy", "name email")
      .select("-__v");

    return res.status(200).json({
      success: true,
      count: colleges.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / limitNumber),
      colleges,
    });
  } catch (error) {
    console.error("Error fetching colleges:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching colleges",
      error: error.message,
    });
  }
};

// Get college names for datalist (simplified version)
export const getCollegeNames = async (req, res) => {
  try {
    const colleges = await College.find({ isActive: true })
      .select("name state district")
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      colleges,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching college names",
      error: error.message,
    });
  }
};

// Get single college by ID
export const getCollegeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "College ID is required",
      });
    }

    const college = await College.findById(id)
      .populate("addedBy", "name email")
      .select("-__v");

    if (!college) {
      return res.status(404).json({
        success: false,
        message: "College not found",
      });
    }

    return res.status(200).json({
      success: true,
      college,
    });
  } catch (error) {
    console.error("Error fetching college:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching college details",
      error: error.message,
    });
  }
};

// Add new college
export const addCollege = async (req, res) => {
  try {
    const { 
      name, 
      district, 
      state, 
      address, 
      course, 
      tpoNo1, 
      tpoNo2, 
      hodNo 
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "College name is required",
      });
    }

    // Check if college already exists
    const existingCollege = await College.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, "i") } 
    });

    if (existingCollege) {
      return res.status(400).json({
        success: false,
        message: "College name already exists",
      });
    }

    const newCollege = await College.create({
      name: name.trim(),
      district,
      state,
      address,
      course,
      tpoNo1,
      tpoNo2,
      hodNo,
      addedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: "College added successfully",
      college: {
        id: newCollege._id,
        name: newCollege.name,
        state: newCollege.state,
        district: newCollege.district
      }
    });
  } catch (error) {
    console.error("Error adding college:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "College name already exists",
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error adding college",
      error: error.message,
    });
  }
};

// Update college
export const updateCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        message: "College ID is required",
        success: false
      });
    }

    // Prevent updating addedBy field
    if (updates.addedBy) {
      delete updates.addedBy;
    }

    // If name is being updated, check for duplicates
    if (updates.name) {
      const existingCollege = await College.findOne({
        name: { $regex: new RegExp(`^${updates.name}$`, "i") },
        _id: { $ne: id }
      });

      if (existingCollege) {
        return res.status(400).json({
          message: "College name already exists",
          success: false
        });
      }
      updates.name = updates.name.trim();
    }

    const college = await College.findByIdAndUpdate(
      id,
      { $set: updates },
      { 
        new: true, 
        runValidators: true 
      }
    ).select("-__v");

    if (!college) {
      return res.status(404).json({
        message: "College not found",
        success: false
      });
    }

    return res.status(200).json({
      message: "College updated successfully",
      success: true,
      college
    });
  } catch (error) {
    console.error("Error updating college:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "College name already exists",
        success: false
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: "Validation error",
        errors: errors,
        success: false
      });
    }

    return res.status(500).json({
      message: "Error updating college details",
      success: false,
      error: error.message
    });
  }
};

// Soft delete college (change isActive to false)
export const deactivateCollege = async (req, res) => {
  try {
    const { id } = req.params;

    const college = await College.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );

    if (!college) {
      return res.status(404).json({
        message: "College not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "College deactivated successfully",
      success: true,
      college
    });
  } catch (error) {
    console.error("Error deactivating college:", error);
    res.status(500).json({
      message: "Error deactivating college",
      success: false,
      error: error.message
    });
  }
};

// Reactivate college
export const reactivateCollege = async (req, res) => {
  try {
    const { id } = req.params;

    const college = await College.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!college) {
      return res.status(404).json({
        message: "College not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "College reactivated successfully",
      success: true,
      college
    });
  } catch (error) {
    console.error("Error reactivating college:", error);
    res.status(500).json({
      message: "Error reactivating college",
      success: false,
      error: error.message
    });
  }
};

// Hard delete college (permanent deletion)
export const deleteCollege = async (req, res) => {
  try {
    const { id } = req.params;

    const college = await College.findByIdAndDelete(id);

    if (!college) {
      return res.status(404).json({
        message: "College not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "College deleted successfully",
      success: true,
    });
  } catch (error) {
    console.error("Error deleting college:", error);
    res.status(500).json({
      message: "Error deleting college",
      success: false,
      error: error.message
    });
  }
};

// Get colleges by state
export const getCollegesByState = async (req, res) => {
  try {
    const { state } = req.params;

    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State parameter is required",
      });
    }

    const colleges = await College.find({
      state: { $regex: new RegExp(state, "i") },
      isActive: true
    }).select("name district course");

    return res.status(200).json({
      success: true,
      count: colleges.length,
      colleges,
    });
  } catch (error) {
    console.error("Error fetching colleges by state:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching colleges by state",
      error: error.message,
    });
  }
};

// Get unique states and districts for filtering
export const getFilters = async (req, res) => {
  try {
    const states = await College.distinct("state");
    const districts = await College.distinct("district");
    const courses = await College.distinct("course");

    return res.status(200).json({
      success: true,
      filters: {
        states: states.filter(state => state).sort(),
        districts: districts.filter(district => district).sort(),
        courses: courses.filter(course => course).sort()
      }
    });
  } catch (error) {
    console.error("Error fetching filters:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching filter options",
      error: error.message,
    });
  }
};