

import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "./cloudinary.js";

// Dynamic Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: (req, file) => {
    const originalName = file.originalname;
    const ext = originalName.split(".").pop().toLowerCase(); // real extension
    const baseName =
      originalName.substring(0, originalName.lastIndexOf(".")) || originalName;

    let resourceType = "image";
    let allowedFormats = ["jpg", "jpeg", "png"];
    let transformation = [{ width: 1000, height: 1000, crop: "limit" }];
    let publicId = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    // For non-image files (pdf, doc, txt, zip)
    if (["pdf", "doc", "docx", "txt", "zip"].includes(ext)) {
      resourceType = "raw";
      allowedFormats = [ext];
      transformation = undefined;
      publicId = `${publicId}.${ext}`;
    }

    return {
      folder: "digicodersAdmin",
      resource_type: resourceType,
      allowed_formats: allowedFormats,
      format: resourceType === "raw" ? undefined : ext,
      transformation,
      public_id: publicId,
      type: "upload", // Ensure it's an uploaded resource
      sign_url: true, // Sign the URL for authentication
    };
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|txt|zip/;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Error: File type not supported!"));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter,
});

export default upload;
