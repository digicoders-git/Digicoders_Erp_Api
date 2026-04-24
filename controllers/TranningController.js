import TranningModal from "../models/tranning.js";

// Main CRUD controller function with switch case
export const trainingController = async (req, res) => {
  const { action } = req.params;

  try {
    switch (action) {
      case "create":
        await createTraining(req, res);
        break;

      case "getAll":
        await getAllTrainings(req, res);
        break;

      case "getById":
        await getTrainingById(req, res);
        break;

      case "update":
        await updateTraining(req, res);
        break;

      case "delete":
        await deleteTraining(req, res);
        break;

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid action. Available actions: create, getAll, getById, update, delete",
        });
    }
  } catch (error) {
    console.error("Training Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Create new training
const createTraining = async (req, res) => {
  try {
    const { name, duration ,registrationAmount} = req.body;

    // Validation
    if (!name || !duration) {
      return res.status(400).json({
        success: false,
        message: "Name and duration are required",
      });
    }

    // Check if training already exists
    const existingTraining = await TranningModal.findOne({ name });
    if (existingTraining) {
      return res.status(400).json({
        success: false,
        message: "Training with this name already exists",
      });
    }

    const newTraining = new TranningModal({
      name,
      duration,
      registrationAmount,
    });

    const savedTraining = await newTraining.save();

    return res.status(201).json({
      success: true,
      message: "Training created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Training name must be unique",
      });
    }
    throw error;
  }
};

// Get all trainings
const getAllTrainings = async (req, res) => {
  try {
    const { page = 1, limit = 1000, search = "" } = req.query;

    const query = search ? { name: { $regex: search, $options: "i" } } : {};

    const trainings = await TranningModal.find(query)
      .populate("duration", "name")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await TranningModal.countDocuments(query);

    return res.status(200).json({
      success: true,
      message: "Trainings retrieved successfully",
      data: trainings,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    throw error;
  }
};

// Get training by ID
const getTrainingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Training ID is required",
      });
    }

    const training = await TranningModal.findById(id);

    if (!training) {
      return res.status(404).json({
        success: false,
        message: "Training not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Training retrieved successfully",
      data: training,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid training ID format",
      });
    }
    throw error;
  }
};

// Update training
const updateTraining = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, duration, isActive ,registrationAmount} = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Training ID is required",
      });
    }

    // Check if training exists
    const existingTraining = await TranningModal.findById(id);
    if (!existingTraining) {
      return res.status(404).json({
        success: false,
        message: "Training not found",
      });
    }

    // Check if new name already exists (excluding current training)
    if (name && name !== existingTraining.name) {
      const nameExists = await TranningModal.findOne({
        name,
        _id: { $ne: id },
      });
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: "Training with this name already exists",
        });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (duration) updateData.duration = duration;
    if (registrationAmount) updateData.registrationAmount = registrationAmount;
    if (typeof isActive !== "undefined") updateData.isActive = isActive;
    const updatedTraining = await TranningModal.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Training updated successfully",
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid training ID format",
      });
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Training name must be unique",
      });
    }
    throw error;
  }
};

// Delete training
const deleteTraining = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Training ID is required",
      });
    }

    const deletedTraining = await TranningModal.findByIdAndDelete(id);

    if (!deletedTraining) {
      return res.status(404).json({
        success: false,
        message: "Training not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Training deleted successfully",
      data: deletedTraining,
    });
  } catch (error) {
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid training ID format",
      });
    }
    throw error;
  }
};
