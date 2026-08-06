import axios from "axios";

const PROJECT_REPORT_API = process.env.PROJECT_REPORT_API || "https://apiprojectreport.thedigicoders.com";

// Helper to handle axios errors and forward response
const forwardError = (res, error) => {
  console.error("Proxy request error:", error.message);
  if (error.response) {
    return res.status(error.response.status).json(error.response.data);
  }
  return res.status(500).json({
    success: false,
    message: "Failed to communicate with project report service",
    error: error.message,
  });
};

// 1. Get all project reports (Admin)
export const getAllProjectReports = async (req, res) => {
  try {
    const params = new URLSearchParams(req.query).toString();
    const response = await axios.get(`${PROJECT_REPORT_API}/api/students?${params}`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardError(res, error);
  }
};

// 2. Get single project report details (Admin)
export const getProjectReportById = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${PROJECT_REPORT_API}/api/students/${id}`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardError(res, error);
  }
};

// 3. Update project report status (Admin)
export const updateProjectReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const response = await axios.put(`${PROJECT_REPORT_API}/api/students/${id}/status`, { status });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardError(res, error);
  }
};

// 4. Update PDF sent status (Admin)
export const updatePdfSentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { pdfSendStudent } = req.body;
    const response = await axios.patch(`${PROJECT_REPORT_API}/api/students/${id}/pdfSendStudent`, { pdfSendStudent });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardError(res, error);
  }
};

// 5. Delete project report (Admin)
export const deleteProjectReport = async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.delete(`${PROJECT_REPORT_API}/api/students/${id}`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardError(res, error);
  }
};

// 6. Get dashboard stats (Admin)
export const getProjectReportDashboardCounts = async (req, res) => {
  try {
    const response = await axios.get(`${PROJECT_REPORT_API}/api/students/dashboard/counts`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardError(res, error);
  }
};

export const getMyReportStatus = async (req, res) => {
  try {
    if (!req.student) {
      return res.status(400).json({
        success: false,
        message: "Student authentication required",
      });
    }

    // Search by student's mobile number, email, or userid using general students endpoint
    const searchVal = req.student.mobile || req.student.email || req.student.userid;
    const response = await axios.get(`${PROJECT_REPORT_API}/api/students?search=${searchVal}`);
    
    const reports = response.data.students || [];

    return res.status(200).json({
      success: true,
      report: reports.length > 0 ? reports[0] : null,
    });
  } catch (error) {
    return forwardError(res, error);
  }
};
