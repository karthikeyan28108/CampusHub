import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Define destination for uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Local storage configuration
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, uniqueSuffix + extension);
  }
});

// Configure Multer
const upload = multer({
  storage: storageConfig,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Cloudinary if credentials are present
const isCloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME && 
                               process.env.CLOUDINARY_API_KEY && 
                               process.env.CLOUDINARY_API_SECRET;

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  console.log('Cloudinary storage service configured.');
} else {
  console.log('Cloudinary credentials missing in .env. Using backend local storage (/uploads) fallback.');
}

// Function to handle the file upload to Cloudinary (or local server fallback)
const uploadFileToStorage = async (file) => {
  if (isCloudinaryConfigured) {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        resource_type: 'auto',
        folder: 'campushub_notes'
      });
      
      // Clean up local temp file after upload to Cloudinary
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      return {
        url: result.secure_url,
        fileType: file.mimetype
      };
    } catch (error) {
      console.error('Cloudinary upload failed, using local fallback:', error.message);
    }
  }

  // Fallback to local URL path
  const filename = path.basename(file.path);
  return {
    url: `/uploads/${filename}`,
    fileType: file.mimetype
  };
};

export { upload, uploadFileToStorage };
