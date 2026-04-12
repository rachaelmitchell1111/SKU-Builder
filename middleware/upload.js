const multer = require('multer');
const path = require('path');
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (jpeg, jpg, png, webp) are allowed.'));
    }
};

// Files are held in memory as Buffers; routes call uploadBuffer() to push to Cloudinary.
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * Upload a Buffer to Cloudinary and return the secure URL.
 * @param {Buffer} buffer
 * @param {object} [options]  Extra Cloudinary upload options (e.g. public_id, tags).
 * @returns {Promise<string>} Cloudinary secure_url
 */
function uploadBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(
                { folder: 'sku-builder', resource_type: 'image', ...options },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result.secure_url);
                }
            )
            .end(buffer);
    });
}

module.exports = { upload, uploadBuffer };
