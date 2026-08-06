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

// 7. Get logged-in student's project report status (Student)
export const getMyReportStatus = async (req, res) => {
  try {
    if (!req.student) {
      return res.status(400).json({
        success: false,
        message: "Student authentication required",
      });
    }

    // Try finding by student's userid (e.g. DCT-xxxx)
    let response;
    try {
      response = await axios.get(`${PROJECT_REPORT_API}/api/students/form?userId=${req.student.userid}`);
    } catch (e) {
      // If not found, fallback to phone number
      response = await axios.get(`${PROJECT_REPORT_API}/api/students/form?userId=${req.student.mobile}`);
    }

    return res.status(200).json({
      success: true,
      report: response.data.form || null,
    });
  } catch (error) {
    // If both fail and return 404, we return null report indicating form is not filled
    if (error.response && error.response.status === 404) {
      return res.status(200).json({
        success: true,
        report: null,
      });
    }
    return forwardError(res, error);
  }
};
