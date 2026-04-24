import cloudinary from '../config/cloudinary.js';

// Delete file from Cloudinary
export const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    throw error;
  }
};

// Extract public ID from Cloudinary URL
export const getPublicIdFromUrl = (url) => {
  if (!url) return null;
  
  const matches = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.(?:jpg|jpeg|png|gif|pdf|doc|docx|txt|zip)/);
  
  if (matches && matches[1]) {
    return matches[1];
  }
  
  // For URLs that might have transformations
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  const publicId = filename.split('.')[0];
  
  return publicId;
};

// Check if file is an image
export const isImage = (filename) => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
};