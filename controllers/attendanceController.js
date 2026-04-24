import mongoose from "mongoose";
import Attendance from "../models/attendance.js";
import Batch from "../models/batchs.js";


export const createAttendance = async (req, res) => {
  try {
    const { batchId, date, records, absents, presents, total } = req.body;

    // Validate required fields
    if (!batchId || !date) {
      return res.status(400).json({
        success: false,
        message: "Batch ID and date are required"
      });
    }

    // Check if batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found"
      });
    }

    // Parse the date to start and end of day
    const attendanceDate = new Date(date);
    const startOfDay = new Date(attendanceDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(attendanceDate.setHours(23, 59, 59, 999));

    // Check if attendance already exists for this batch on this date
    const existingAttendance = await Attendance.findOne({
      batchId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    let attendance;

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.records = records;
      existingAttendance.presents = presents;
      existingAttendance.absents = absents;
      existingAttendance.total = total;
      existingAttendance.attendBy = req.user?._id;
      existingAttendance.updatedAt = Date.now();

      attendance = await existingAttendance.save();

      return res.status(200).json({
        success: true,
        message: "Attendance updated successfully",
        data: attendance
      });
    } else {
      // Create new attendance
      attendance = new Attendance({
        batchId,
        date,
        records,
        presents,
        absents,
        total,
        attendBy: req.user?._id
      });

      await attendance.save();

      return res.status(201).json({
        success: true,
        message: "Attendance created successfully",
        data: attendance
      });
    }
  } catch (error) {
    console.error("Error creating/updating attendance:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Attendance already exists for this date & batch"
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Update existing attendance (for PUT route)
export const updateAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { records, presents, absents, total } = req.body;

    // Find attendance
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found"
      });
    }

    // Update records
    if (records) {
      attendance.records = records;
    }

    // Update counts
    if (presents !== undefined) attendance.presents = presents;
    if (absents !== undefined) attendance.absents = absents;
    if (total !== undefined) attendance.total = total;

    attendance.updatedAt = Date.now();
    attendance.attendBy = req.user?._id;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Check if attendance exists for batch on current date

export const checkTodayAttendance = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { date } = req.query;

    const queryDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(new Date(queryDate).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(queryDate).setHours(23, 59, 59, 999));

    const attendance = await Attendance.findOne({
      batchId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
      .populate({
        path: 'records.studentId',
        select: '_id studentName'
      })
      .populate("attendBy", "name");

    if (attendance) {
      // Format the data properly for frontend
      const formattedData = {
        ...attendance.toObject(),
        records: attendance.records.map(record => ({
          studentId: record.studentId?._id || record.studentId,
          status: record.status
        }))
      };

      return res.status(200).json({
        success: true,
        exists: true,
        data: formattedData,
        message: "Attendance already exists for today"
      });
    }

    res.status(200).json({
      success: true,
      exists: false,
      message: "No attendance found for today"
    });
  } catch (error) {
    console.error("Error checking today's attendance:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Get attendance by batch (all dates)
// Updated getBatchAttendance controller
export const getBatchAttendance = async (req, res) => {
  try {
    const { batchId } = req.params;
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      sortBy = "date",
      sortOrder = "desc"
    } = req.query;

    // Build query
    const query = { batchId };

    // Date range filter
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get total count and attendance records
    const [total, attendance] = await Promise.all([
      Attendance.countDocuments(query),
      Attendance.find(query)
        .populate({
          path: 'records.studentId',
          select: 'studentName fatherName'
        })
        .populate("attendBy", "name")
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        limit: limitNum
      }
    });
  } catch (error) {
    console.error("Error fetching batch attendance:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

// ✅ Mark attendance for specific student (PATCH route)
export const markAttendance = async (req, res) => {
  try {
    const { attendanceId } = req.params;
    const { studentId, status } = req.body;

    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found"
      });
    }

    // Update or add record
    const recordIndex = attendance.records.findIndex(
      (r) => r.studentId.toString() === studentId
    );

    if (recordIndex !== -1) {
      attendance.records[recordIndex].status = status;
    } else {
      attendance.records.push({
        studentId: studentId,
        status: status
      });
    }

    // Recalculate counts
    attendance.presents = attendance.records.filter(r => r.status === "Present").length;
    attendance.absents = attendance.records.filter(r => r.status === "Absent").length;
    attendance.updatedAt = Date.now();

    await attendance.save();
    res.status(200).json({
      success: true,
      message: "Attendance updated",
      data: attendance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const getoverallData = async (req, res) => {
  try {
    // Aggregate attendance data for all batches
    const overallData = await Attendance.aggregate([
      {
        $lookup: {
          from: 'batches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },
      {
        $unwind: '$batch'
      },
      {
        $group: {
          _id: '$batchId',
          batchName: { $first: '$batch.batchName' },
          totalRecords: { $sum: 1 },
          avgAttendance: {
            $avg: {
              $multiply: [
                { $divide: ['$presents', '$total'] },
                100
              ]
            }
          },
          totalStudents: { $first: '$total' }
        }
      },
      {
        $project: {
          name: '$batchName',
          attendance: { $round: ['$avgAttendance', 2] },
          students: '$totalStudents',
          present: {
            $round: [
              {
                $multiply: [
                  { $divide: ['$avgAttendance', 100] },
                  '$students'
                ]
              }
            ]
          },
          absent: {
            $round: [
              {
                $subtract: [
                  '$students',
                  {
                    $multiply: [
                      { $divide: ['$avgAttendance', 100] },
                      '$students'
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      {
        $sort: { attendance: -1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: overallData
    });
  } catch (error) {
    console.error('Error fetching overall chart data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}


// ✅ Get attendance of single student in a batch
export const getStudentAttendance = async (req, res) => {
  try {
    const { batchId, studentId } = req.params;
    const records = await Attendance.find({ batch: batchId, "records.student": studentId })
      .select("date records")
      .sort({ date: -1 });

    // filter student only
    const studentRecords = records.map((a) => ({
      date: a.date,
      status: a.records.find(
        (r) => r.student.toString() === studentId
      )?.status,
    }));

    res.json(studentRecords);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get student attendance
export const getStuAttendance = async (req, res) => {
  try {
    const studentId = req.student.id;


    const { month, year } = req.query;

    // Validate studentId
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID format"
      });
    }

    // Calculate start and end dates for the selected month/year
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    // Find attendance records for the student in the specified month/year
    const attendanceRecords = await Attendance.find({
      date: { $gte: startDate, $lte: endDate },
      "records.studentId": studentId
    })
      .populate("batchId", "batchName")
      .populate("attendBy", "name")
      .sort({ date: 1 });

    // Process the data to extract student-specific information
    const studentAttendance = [];
    let presentCount = 0;
    let totalClasses = 0;

    attendanceRecords.forEach(record => {
      const studentRecord = record.records.find(
        r => r.studentId.toString() === studentId
      );

      if (studentRecord) {
        totalClasses++;
        if (studentRecord.status === "Present") {
          presentCount++;
        }

        studentAttendance.push({
          date: record.date,
          subject: record.batchId.batchName, // Assuming batchName represents the subject
          status: studentRecord.status.toLowerCase(),
          remarks: "", // You can add remarks field to your schema if needed
          takenBy: record.attendBy.name
        });
      }
    });

    // Calculate attendance percentage
    const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        records: studentAttendance,
        totalClasses,
        present: presentCount,
        absent: totalClasses - presentCount,
        percentage
      }
    });

  } catch (error) {
    console.error("Error fetching student attendance:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ===========

// Get absent students report
export const getAbsentReports = async (req, res) => {
  try {
    const {
      batchId,
      studentId,
      fromDate,
      toDate,
      minAbsentDays,
      page = 1,
      limit = 10
    } = req.query;

    // Build match query
    const matchQuery = {};

    if (batchId) {
      matchQuery.batchId = new mongoose.Types.ObjectId(batchId);
    }

    // Date range filter
    if (fromDate || toDate) {
      matchQuery.date = {};
      if (fromDate) {
        matchQuery.date.$gte = new Date(fromDate);
      }
      if (toDate) {
        matchQuery.date.$lte = new Date(toDate);
      }
    }

    // Aggregation pipeline
    const pipeline = [
      // Match attendance records
      { $match: matchQuery },

      // Unwind records array
      { $unwind: "$records" },

      // Filter only absent records
      { $match: { "records.status": "Absent" } },

      // Group by student
      {
        $group: {
          _id: "$records.studentId",
          totalDays: { $sum: 1 },
          absentDates: { $push: "$date" },
          batchId: { $first: "$batchId" },
          attendanceIds: { $push: "$_id" }
        }
      },

      // Lookup student details
      {
        $lookup: {
          from: 'registrations',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },

      // Lookup batch details
      {
        $lookup: {
          from: 'batches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },
      { $unwind: { path: "$batch", preserveNullAndEmptyArrays: true } },

      // Get all attendance for present days calculation
      {
        $lookup: {
          from: 'attendances',
          let: { studentId: "$_id", batchId: "$batchId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$batchId", "$$batchId"] },
                    { $in: ["$$studentId", "$records.studentId"] }
                  ]
                }
              }
            },
            { $unwind: "$records" },
            {
              $match: {
                $expr: { $eq: ["$records.studentId", "$$studentId"] }
              }
            },
            {
              $group: {
                _id: null,
                presentDays: {
                  $sum: {
                    $cond: [{ $eq: ["$records.status", "Present"] }, 1, 0]
                  }
                },
                lastPresentDate: {
                  $max: {
                    $cond: [
                      { $eq: ["$records.status", "Present"] },
                      "$date",
                      null
                    ]
                  }
                },
                lastAbsentDate: {
                  $max: {
                    $cond: [
                      { $eq: ["$records.status", "Absent"] },
                      "$date",
                      null
                    ]
                  }
                }
              }
            }
          ],
          as: 'attendanceDetails'
        }
      },
      { $unwind: { path: "$attendanceDetails", preserveNullAndEmptyArrays: true } },

      // Calculate consecutive absent days
      {
        $addFields: {
          absentDatesSorted: {
            $sortArray: {
              input: "$absentDates",
              sortBy: { date: -1 }
            }
          }
        }
      },
      {
        $addFields: {
          consecutiveAbsentDays: {
            $let: {
              vars: {
                sortedDates: "$absentDatesSorted"
              },
              in: {
                $reduce: {
                  input: { $slice: ["$$sortedDates", 1, { $size: "$$sortedDates" }] },
                  initialValue: {
                    count: 1,
                    prevDate: { $arrayElemAt: ["$$sortedDates", 0] }
                  },
                  in: {
                    count: {
                      $cond: [
                        {
                          $eq: [
                            {
                              $dateDiff: {
                                startDate: "$$value.prevDate",
                                endDate: "$$this",
                                unit: "day"
                              }
                            },
                            1
                          ]
                        },
                        { $add: ["$$value.count", 1] },
                        "$$value.count"
                      ]
                    },
                    prevDate: "$$this"
                  }
                }
              }
            }
          }
        }
      },

      // Project final fields
      {
        $project: {
          studentId: "$_id",
          studentName: "$student.studentName",
          fatherName: "$student.fatherName",
          registrationId: "$student.registrationId",
          batchId: "$batchId",
          batchName: "$batch.batchName",
          totalDays: {
            $add: [
              "$totalDays",
              { $ifNull: ["$attendanceDetails.presentDays", 0] }
            ]
          },
          presentDays: { $ifNull: ["$attendanceDetails.presentDays", 0] },
          absentDays: "$totalDays",
          absentDates: 1,
          attendancePercentage: {
            $multiply: [
              {
                $divide: [
                  { $ifNull: ["$attendanceDetails.presentDays", 0] },
                  {
                    $add: [
                      "$totalDays",
                      { $ifNull: ["$attendanceDetails.presentDays", 0] }
                    ]
                  }
                ]
              },
              100
            ]
          },
          lastPresentDate: "$attendanceDetails.lastPresentDate",
          lastAbsentDate: "$attendanceDetails.lastAbsentDate",
          consecutiveAbsentDays: "$consecutiveAbsentDays.count",
          attendanceStatus: {
            $switch: {
              branches: [
                {
                  case: {
                    $lt: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              { $ifNull: ["$attendanceDetails.presentDays", 0] },
                              {
                                $add: [
                                  "$totalDays",
                                  { $ifNull: ["$attendanceDetails.presentDays", 0] }
                                ]
                              }
                            ]
                          },
                          100
                        ]
                      },
                      50
                    ]
                  },
                  then: "Poor"
                },
                {
                  case: {
                    $lt: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              { $ifNull: ["$attendanceDetails.presentDays", 0] },
                              {
                                $add: [
                                  "$totalDays",
                                  { $ifNull: ["$attendanceDetails.presentDays", 0] }
                                ]
                              }
                            ]
                          },
                          100
                        ]
                      },
                      75
                    ]
                  },
                  then: "Average"
                }
              ],
              default: "Good"
            }
          }
        }
      },

      // Filter by minimum absent days
      ...(minAbsentDays ? [
        {
          $match: {
            absentDays: { $gte: parseInt(minAbsentDays) }
          }
        }
      ] : []),

      // Filter by specific student
      ...(studentId ? [
        {
          $match: {
            studentId: new mongoose.Types.ObjectId(studentId)
          }
        }
      ] : []),

      // Sort by absent days (descending)
      { $sort: { absentDays: -1 } }
    ];

    // Execute aggregation
    const [results, total] = await Promise.all([
      Attendance.aggregate([
        ...pipeline,
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ]),
      Attendance.aggregate([
        ...pipeline,
        { $count: "total" }
      ])
    ]);

    // Calculate statistics
    const statsPipeline = [
      ...pipeline,
      {
        $group: {
          _id: null,
          totalAbsentStudents: { $sum: 1 },
          averageAbsentDays: { $avg: "$absentDays" },
          mostAbsentStudent: {
            $first: {
              studentName: "$studentName",
              absentDays: "$absentDays"
            }
          },
          highestAbsentDays: { $max: "$absentDays" }
        }
      }
    ];

    const statsResult = await Attendance.aggregate(statsPipeline);
    const stats = statsResult[0] || {
      totalAbsentStudents: 0,
      averageAbsentDays: 0,
      mostAbsentStudent: null,
      highestAbsentDays: 0
    };

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / parseInt(limit))
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching absent reports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get individual student absent details
export const getStudentAbsentDetails = async (req, res) => {
  try {
    const { studentId } = req.params;

    const pipeline = [
      // Match attendance records for this student
      {
        $match: {
          "records.studentId": new mongoose.Types.ObjectId(studentId),
          "records.status": "Absent"
        }
      },

      // Unwind records
      { $unwind: "$records" },

      // Filter only this student's absent records
      {
        $match: {
          "records.studentId": new mongoose.Types.ObjectId(studentId),
          "records.status": "Absent"
        }
      },

      // Lookup batch details
      {
        $lookup: {
          from: 'batches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },
      { $unwind: "$batch" },

      // Lookup student details
      {
        $lookup: {
          from: 'registrations',
          localField: 'records.studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: "$student" },

      // Group by student
      {
        $group: {
          _id: "$records.studentId",
          studentName: { $first: "$student.studentName" },
          batchName: { $first: "$batch.batchName" },
          totalAbsentDays: { $sum: 1 },
          absentDates: { $push: "$date" },
          batchId: { $first: "$batchId" }
        }
      },

      // Get all attendance for this student in this batch
      {
        $lookup: {
          from: 'attendances',
          let: { studentId: "$_id", batchId: "$batchId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$batchId", "$$batchId"] },
                    { $in: ["$$studentId", "$records.studentId"] }
                  ]
                }
              }
            },
            { $unwind: "$records" },
            {
              $match: {
                $expr: { $eq: ["$records.studentId", "$$studentId"] }
              }
            },
            {
              $group: {
                _id: null,
                presentDays: {
                  $sum: {
                    $cond: [{ $eq: ["$records.status", "Present"] }, 1, 0]
                  }
                },
                totalDays: { $sum: 1 },
                lastPresentDate: {
                  $max: {
                    $cond: [
                      { $eq: ["$records.status", "Present"] },
                      "$date",
                      null
                    ]
                  }
                }
              }
            }
          ],
          as: 'attendanceStats'
        }
      },
      { $unwind: { path: "$attendanceStats", preserveNullAndEmptyArrays: true } },

      // Calculate consecutive absent days
      {
        $addFields: {
          absentDatesSorted: {
            $sortArray: {
              input: "$absentDates",
              sortBy: { date: -1 }
            }
          }
        }
      },
      {
        $addFields: {
          consecutiveAbsentDays: {
            $let: {
              vars: {
                sortedDates: "$absentDatesSorted"
              },
              in: {
                $reduce: {
                  input: { $slice: ["$$sortedDates", 1, { $size: "$$sortedDates" }] },
                  initialValue: {
                    count: 1,
                    prevDate: { $arrayElemAt: ["$$sortedDates", 0] }
                  },
                  in: {
                    count: {
                      $cond: [
                        {
                          $eq: [
                            {
                              $dateDiff: {
                                startDate: "$$value.prevDate",
                                endDate: "$$this",
                                unit: "day"
                              }
                            },
                            1
                          ]
                        },
                        { $add: ["$$value.count", 1] },
                        "$$value.count"
                      ]
                    },
                    prevDate: "$$this"
                  }
                }
              }
            }
          }
        }
      },

      // Final projection
      {
        $project: {
          studentId: "$_id",
          studentName: 1,
          batchName: 1,
          totalDays: { $ifNull: ["$attendanceStats.totalDays", 0] },
          presentDays: { $ifNull: ["$attendanceStats.presentDays", 0] },
          absentDays: "$totalAbsentDays",
          absentDates: 1,
          attendancePercentage: {
            $multiply: [
              {
                $divide: [
                  { $ifNull: ["$attendanceStats.presentDays", 0] },
                  {
                    $add: [
                      "$totalAbsentDays",
                      { $ifNull: ["$attendanceStats.presentDays", 0] }
                    ]
                  }
                ]
              },
              100
            ]
          },
          lastPresentDate: "$attendanceStats.lastPresentDate",
          consecutiveAbsentDays: "$consecutiveAbsentDays.count"
        }
      }
    ];

    const result = await Attendance.aggregate(pipeline);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or no absent records'
      });
    }

    res.status(200).json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error('Error fetching student absent details:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};


// Get attendance reports with detailed analytics
export const getAttendanceReports = async (req, res) => {
  try {
    const {
      batchId,
      studentId,
      month,
      fromDate,
      toDate,
      minAttendance,
      maxAttendance,
      page = 1,
      limit = 10
    } = req.query;

    // Build date range
    let dateFilter = {};
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const start = new Date(year, monthNum - 1, 1);
      const end = new Date(year, monthNum, 0, 23, 59, 59);
      dateFilter = { date: { $gte: start, $lte: end } };
    } else if (fromDate || toDate) {
      dateFilter.date = {};
      if (fromDate) dateFilter.date.$gte = new Date(fromDate);
      if (toDate) dateFilter.date.$lte = new Date(toDate);
    } else {
      // Default to current month
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      dateFilter = { date: { $gte: start, $lte: end } };
    }

    // Build batch filter
    const batchFilter = batchId ? { batchId: new mongoose.Types.ObjectId(batchId) } : {};

    // Main aggregation pipeline
    const pipeline = [
      // Match attendance records
      { $match: { ...dateFilter, ...batchFilter } },

      // Unwind records
      { $unwind: "$records" },

      // Group by student
      {
        $group: {
          _id: "$records.studentId",
          attendanceRecords: {
            $push: {
              date: "$date",
              status: "$records.status",
              batchId: "$batchId"
            }
          },
          batchIds: { $addToSet: "$batchId" }
        }
      },

      // Lookup student details
      {
        $lookup: {
          from: 'registrations',
          localField: '_id',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: "$student" },

      // Lookup batch details
      {
        $lookup: {
          from: 'batches',
          localField: 'batchIds',
          foreignField: '_id',
          as: 'batches'
        }
      },

      // Calculate statistics
      {
        $addFields: {
          workingDays: { $size: "$attendanceRecords" },
          presentDays: {
            $size: {
              $filter: {
                input: "$attendanceRecords",
                as: "record",
                cond: { $eq: ["$$record.status", "Present"] }
              }
            }
          },
          absentDays: {
            $size: {
              $filter: {
                input: "$attendanceRecords",
                as: "record",
                cond: { $eq: ["$$record.status", "Absent"] }
              }
            }
          },
          lateDays: {
            $size: {
              $filter: {
                input: "$attendanceRecords",
                as: "record",
                cond: { $eq: ["$$record.status", "Late"] }
              }
            }
          },
          attendancePercentage: {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $filter: {
                        input: "$attendanceRecords",
                        as: "record",
                        cond: { $eq: ["$$record.status", "Present"] }
                      }
                    }
                  },
                  { $size: "$attendanceRecords" }
                ]
              },
              100
            ]
          },
          // Get last 7 days status
          last7Days: {
            $slice: [
              {
                $map: {
                  input: {
                    $sortArray: {
                      input: "$attendanceRecords",
                      sortBy: { date: -1 }
                    }
                  },
                  as: "record",
                  in: "$$record.status"
                }
              },
              0,
              7
            ]
          },
          // Get monthly trend (last 15 days)
          monthlyTrend: {
            $slice: [
              {
                $map: {
                  input: {
                    $sortArray: {
                      input: "$attendanceRecords",
                      sortBy: { date: -1 }
                    }
                  },
                  as: "record",
                  in: {
                    date: "$$record.date",
                    status: "$$record.status"
                  }
                }
              },
              0,
              15
            ]
          },
          // Get attendance status
          attendanceStatus: {
            $switch: {
              branches: [
                {
                  case: {
                    $lt: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              {
                                $size: {
                                  $filter: {
                                    input: "$attendanceRecords",
                                    as: "record",
                                    cond: { $eq: ["$$record.status", "Present"] }
                                  }
                                }
                              },
                              { $size: "$attendanceRecords" }
                            ]
                          },
                          100
                        ]
                      },
                      60
                    ]
                  },
                  then: "Poor"
                },
                {
                  case: {
                    $lt: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              {
                                $size: {
                                  $filter: {
                                    input: "$attendanceRecords",
                                    as: "record",
                                    cond: { $eq: ["$$record.status", "Present"] }
                                  }
                                }
                              },
                              { $size: "$attendanceRecords" }
                            ]
                          },
                          100
                        ]
                      },
                      75
                    ]
                  },
                  then: "Average"
                },
                {
                  case: {
                    $lt: [
                      {
                        $multiply: [
                          {
                            $divide: [
                              {
                                $size: {
                                  $filter: {
                                    input: "$attendanceRecords",
                                    as: "record",
                                    cond: { $eq: ["$$record.status", "Present"] }
                                  }
                                }
                              },
                              { $size: "$attendanceRecords" }
                            ]
                          },
                          100
                        ]
                      },
                      85
                    ]
                  },
                  then: "Good"
                }
              ],
              default: "Excellent"
            }
          }
        }
      },

      // Filter by student
      ...(studentId ? [
        {
          $match: {
            _id: new mongoose.Types.ObjectId(studentId)
          }
        }
      ] : []),

      // Filter by attendance percentage
      ...(minAttendance ? [
        {
          $match: {
            attendancePercentage: { $gte: parseFloat(minAttendance) }
          }
        }
      ] : []),
      ...(maxAttendance ? [
        {
          $match: {
            attendancePercentage: { $lte: parseFloat(maxAttendance) }
          }
        }
      ] : []),

      // Final projection
      {
        $project: {
          studentId: "$_id",
          studentName: "$student.studentName",
          fatherName: "$student.fatherName",
          registrationId: "$student.registrationId",
          batchName: { $arrayElemAt: ["$batches.batchName", 0] },
          workingDays: 1,
          presentDays: 1,
          absentDays: 1,
          lateDays: 1,
          attendancePercentage: 1,
          last7Days: 1,
          monthlyTrend: 1,
          attendanceStatus: 1,
          batchId: { $arrayElemAt: ["$batchIds", 0] }
        }
      },

      // Sort by attendance percentage (descending)
      { $sort: { attendancePercentage: -1 } }
    ];

    // Execute aggregation
    const [results, total] = await Promise.all([
      Attendance.aggregate([
        ...pipeline,
        { $skip: (parseInt(page) - 1) * parseInt(limit) },
        { $limit: parseInt(limit) }
      ]),
      Attendance.aggregate([
        ...pipeline,
        { $count: "total" }
      ])
    ]);

    // Get monthly data for calendar view
    const monthlyPipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          totalStudents: { $sum: 1 },
          present: {
            $sum: {
              $size: {
                $filter: {
                  input: "$records",
                  as: "record",
                  cond: { $eq: ["$$record.status", "Present"] }
                }
              }
            }
          },
          absent: {
            $sum: {
              $size: {
                $filter: {
                  input: "$records",
                  as: "record",
                  cond: { $eq: ["$$record.status", "Absent"] }
                }
              }
            }
          },
          late: {
            $sum: {
              $size: {
                $filter: {
                  input: "$records",
                  as: "record",
                  cond: { $eq: ["$$record.status", "Late"] }
                }
              }
            }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          totalStudents: 1,
          present: 1,
          absent: 1,
          late: 1,
          percentage: {
            $multiply: [
              { $divide: ["$present", "$totalStudents"] },
              100
            ]
          }
        }
      },
      { $sort: { date: 1 } }
    ];

    const monthlyData = await Attendance.aggregate(monthlyPipeline);

    // Get daily attendance for calendar
    const dailyAttendance = monthlyData.map(day => ({
      ...day,
      date: day.date
    }));

    // Calculate statistics
    const statsPipeline = [
      ...pipeline,
      {
        $group: {
          _id: null,
          totalStudents: { $sum: 1 },
          averageAttendance: { $avg: "$attendancePercentage" },
          totalPresentDays: { $sum: "$presentDays" },
          totalAbsentDays: { $sum: "$absentDays" },
          bestAttendanceStudent: {
            $first: {
              name: "$studentName",
              percentage: "$attendancePercentage"
            }
          },
          worstAttendanceStudent: {
            $last: {
              name: "$studentName",
              percentage: "$attendancePercentage"
            }
          }
        }
      }
    ];

    const statsResult = await Attendance.aggregate(statsPipeline);
    const stats = statsResult[0] || {
      totalStudents: 0,
      averageAttendance: 0,
      bestAttendanceStudent: null,
      worstAttendanceStudent: null,
      totalPresentDays: 0,
      totalAbsentDays: 0
    };

    res.status(200).json({
      success: true,
      data: results,
      monthlyData,
      dailyAttendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total[0]?.total || 0,
        pages: Math.ceil((total[0]?.total || 0) / parseInt(limit))
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching attendance reports:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get detailed student report
export const getStudentDetailedReport = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { month } = req.query;

    // Build date range
    let dateFilter = {};
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const start = new Date(year, monthNum - 1, 1);
      const end = new Date(year, monthNum, 0, 23, 59, 59);
      dateFilter = { date: { $gte: start, $lte: end } };
    }

    const pipeline = [
      // Match attendance records for this student
      {
        $match: {
          ...dateFilter,
          "records.studentId": new mongoose.Types.ObjectId(studentId)
        }
      },

      // Unwind records
      { $unwind: "$records" },

      // Filter this student's records
      {
        $match: {
          "records.studentId": new mongoose.Types.ObjectId(studentId)
        }
      },

      // Lookup batch details
      {
        $lookup: {
          from: 'batches',
          localField: 'batchId',
          foreignField: '_id',
          as: 'batch'
        }
      },
      { $unwind: "$batch" },

      // Lookup student details
      {
        $lookup: {
          from: 'registrations',
          localField: 'records.studentId',
          foreignField: '_id',
          as: 'student'
        }
      },
      { $unwind: "$student" },

      // Group and calculate
      {
        $group: {
          _id: "$records.studentId",
          studentName: { $first: "$student.studentName" },
          batchName: { $first: "$batch.batchName" },
          dailyAttendance: {
            $push: {
              date: "$date",
              status: "$records.status"
            }
          },
          detailedRecords: {
            $push: {
              date: "$date",
              status: "$records.status",
              time: "$records.time",
              remarks: "$records.remarks"
            }
          }
        }
      },

      // Calculate statistics
      {
        $addFields: {
          workingDays: { $size: "$dailyAttendance" },
          presentDays: {
            $size: {
              $filter: {
                input: "$dailyAttendance",
                as: "record",
                cond: { $eq: ["$$record.status", "Present"] }
              }
            }
          },
          absentDays: {
            $size: {
              $filter: {
                input: "$dailyAttendance",
                as: "record",
                cond: { $eq: ["$$record.status", "Absent"] }
              }
            }
          },
          attendancePercentage: {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $filter: {
                        input: "$dailyAttendance",
                        as: "record",
                        cond: { $eq: ["$$record.status", "Present"] }
                      }
                    }
                  },
                  { $size: "$dailyAttendance" }
                ]
              },
              100
            ]
          },
          // Calculate streaks
          currentStreak: {
            $let: {
              vars: {
                sorted: {
                  $sortArray: {
                    input: "$dailyAttendance",
                    sortBy: { date: -1 }
                  }
                }
              },
              in: {
                $reduce: {
                  input: "$$sorted",
                  initialValue: { streak: 0, broken: false },
                  in: {
                    streak: {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$$this.status", "Present"] },
                            { $not: "$$value.broken" }
                          ]
                        },
                        { $add: ["$$value.streak", 1] },
                        "$$value.streak"
                      ]
                    },
                    broken: {
                      $cond: [
                        { $eq: ["$$this.status", "Absent"] },
                        true,
                        "$$value.broken"
                      ]
                    }
                  }
                }
              }
            }
          },
          bestStreak: {
            $let: {
              vars: {
                sorted: {
                  $sortArray: {
                    input: "$dailyAttendance",
                    sortBy: { date: 1 }
                  }
                }
              },
              in: {
                $reduce: {
                  input: "$$sorted",
                  initialValue: { current: 0, best: 0 },
                  in: {
                    current: {
                      $cond: [
                        { $eq: ["$$this.status", "Present"] },
                        { $add: ["$$value.current", 1] },
                        0
                      ]
                    },
                    best: {
                      $cond: [
                        { $gt: [{ $add: ["$$value.current", 1] }, "$$value.best"] },
                        { $add: ["$$value.current", 1] },
                        "$$value.best"
                      ]
                    }
                  }
                }
              }
            }
          },
          lastPresentDate: {
            $max: {
              $cond: [
                { $eq: ["$records.status", "Present"] },
                "$date",
                null
              ]
            }
          },
          lastAbsentDate: {
            $max: {
              $cond: [
                { $eq: ["$records.status", "Absent"] },
                "$date",
                null
              ]
            }
          }
        }
      },

      // Final projection
      {
        $project: {
          studentId: "$_id",
          studentName: 1,
          batchName: 1,
          workingDays: 1,
          presentDays: 1,
          absentDays: 1,
          attendancePercentage: 1,
          dailyAttendance: 1,
          detailedRecords: { $sortArray: { input: "$detailedRecords", sortBy: { date: -1 } } },
          currentStreak: "$currentStreak.streak",
          bestStreak: "$bestStreak.best",
          lastPresentDate: 1,
          lastAbsentDate: 1
        }
      }
    ];

    const result = await Attendance.aggregate(pipeline);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or no attendance records'
      });
    }

    res.status(200).json({
      success: true,
      data: result[0]
    });

  } catch (error) {
    console.error('Error fetching student detailed report:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};