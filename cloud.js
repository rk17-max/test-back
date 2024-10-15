const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'pdfs', // Folder in Cloudinary
        
        allowed_formats: ['png', 'pdf'], // Allowed file formats
        public_id: (req, file) => file.originalname.split('.')[0], // Use original file name
        resource_type: 'raw', // Important for non-image files like PDFs
    },
});

module.exports = storage;
