import multer from "multer";
import path from "path";
import fs from "fs";

// Upload folder
const uploadPath = "uploads";
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const imageTypes = /jpeg|jpg|png|webp/;
const pdfTypes = /pdf/;
const xlsxTypes = /xlsx|xls/;

// Fields where PDF is allowed
const pdfAllowedFields = ["assignmentFiles", "cv", "aadharCard", "submittedFile"];
const imageAllowedFields = ["profilePhoto", "image", "assignmentFiles", "submittedFile", "aadharCard"];
const xlsxAllowedFields = ["importFile"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  const isImage = imageTypes.test(ext) && imageTypes.test(mime);
  const isPdf = pdfTypes.test(ext) && mime === "application/pdf";
  const isXlsx = xlsxTypes.test(ext) && (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  );

  if (isXlsx) {
    if (xlsxAllowedFields.includes(file.fieldname)) {
      return cb(null, true);
    } else {
      return cb(new Error(`Excel file is not allowed for ${file.fieldname}`), false);
    }
  }

  // Check if field is allowed for PDF
  if (isPdf) {
    if (pdfAllowedFields.includes(file.fieldname)) {
      return cb(null, true);
    } else {
      return cb(new Error(`PDF is not allowed for ${file.fieldname}`), false);
    }
  }

  // Check if field is allowed for Image
  if (isImage) {
    if (imageAllowedFields.includes(file.fieldname)) {
      return cb(null, true);
    } else {
      return cb(new Error(`Image is not allowed for ${file.fieldname}`), false);
    }
  }

  return cb(
    new Error(
      "Invalid file type. Only images and PDFs (for specific fields) are allowed."
    ),
    false
  );
};

// Multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});

export default upload;
