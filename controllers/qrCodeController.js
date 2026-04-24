import QrCode from "../models/qrCode.js";

// ✅ Create new QR Code
export const createQrCode = async (req, res) => {
  try {
    const { name, upi, bankName } = req.body;
    const img = req.file;

    if (!name || !upi || !bankName || !img) {
      return res.status(400).json({
        success: false,
        message: "Name and image and upi are required",
      });
    }

    const qrCode = await QrCode.create({
      name,
      upi,
      bankName,
      image: {
        url: `/uploads/${img.filename}`,
        public_id: img?.filename,
      },
    });

    return res.status(201).json({
      success: true,
      message: "QR Code created successfully",

    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error creating QR Code",
      error: error.message,
    });
  }
};

// ✅ Get all QR Codes
// export const getAllQrCodes = async (req, res) => {
//   try {
//     const qrCodes = await QrCode.find();

//     return res.status(200).json({
//       success: true,
//       count: qrCodes.length,
//       data: qrCodes,
//     });
//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Error fetching QR Codes",
//       error: error.message,
//     });
//   }
// };
export const getAllQrCodes = async (req, res) => {
  try {
    const {
      search,
      bankName,
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
        { bankName: { $regex: search, $options: "i" } },
        { upi: { $regex: search, $options: "i" } }
      ];
    }

    // Bank name filter
    if (bankName && bankName !== "All") {
      filter.bankName = bankName;
    }

    // Active status filter
    if (isActive !== undefined && isActive !== "All") {
      filter.isActive = isActive === "true";
    }

    // Sorting
    const sortOptions = {};
    const allowedSortFields = [
      "name", "bankName", "upi", "isActive", "createdAt", "updatedAt"
    ];

    // Validate sort field
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Get total count for pagination
    const totalCount = await QrCode.countDocuments(filter);

    // Query with pagination
    const qrCodes = await QrCode.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNumber);

    return res.status(200).json({
      success: true,
      message: "Successfully fetched QR Codes",
      count: qrCodes.length,
      total: totalCount,
      page: pageNumber,
      pages: Math.ceil(totalCount / limitNumber),
      data: qrCodes,
    });
  } catch (error) {
    console.error("Error fetching QR Codes:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching QR Codes",
      error: error.message,
    });
  }
};
// ✅ Get QR Code by ID
export const getQrCodeById = async (req, res) => {
  try {
    const qrCode = await QrCode.findById(req.params.id);

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: "QR Code not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: qrCode,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching QR Code",
      error: error.message,
    });
  }
};


export const deleteQrCode = async (req, res) => {
  try {
    const qrCode = await QrCode.findByIdAndDelete(req.params.id);
    if (!qrCode) {
      return res.status(404).json({ message: "QR Code not found" });
    }
    return res.status(200).json({ message: "QR Code deleted successfully" });

  } catch (error) {
    res.status(500).json({ message: "Error deleting QR Code", error: error.message });
  }
}
export const updataQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, name, upi, bankName } = req.body;
    const img = req?.file
    if (!id) return res.status(400).json({ message: "id is requrid", success: false });
    const qrCode = await QrCode.findById(id);
    if (!qrCode)
      return res.status(404).json({ message: "qrCode data is not found", success: false });
    if (name) qrCode.name = name;
    if (bankName) qrCode.bankName = bankName;
    if (upi) qrCode.upi = upi;
    if (typeof isActive !== "undefined") qrCode.isActive = isActive;
    if (img) {
      qrCode.image.url = `/uploads/${img.filename}`
      qrCode.image.public_id = img.filename
    }

    await qrCode.save();
    return res
      .status(200)
      .json({ message: "updata succesfull", success: true });
  } catch (error) {
    res.status(500).json({ message: "Error updateing qrCode detels" });
  }
};