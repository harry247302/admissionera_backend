const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '../../upload');
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype || !file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed for logo and banner'));
  }
  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

/** Accept multipart fields: logo, banner (images only). */
const uploadUniversityMedia = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
]);

/**
 * Convert an uploaded image buffer to WebP (<= 2MB) and save under /upload.
 * Returns a public path like `/uploads/<filename>.webp`.
 */
const saveUniversityImageAsWebp = async (file, prefix = 'university') => {
  if (!file?.buffer) return null;

  if (file.size > MAX_BYTES) {
    const err = new Error('Image must be under 2MB');
    err.status = 400;
    throw err;
  }

  let quality = 82;
  let output = await sharp(file.buffer)
    .rotate()
    .webp({ quality, effort: 4 })
    .toBuffer();

  while (output.length > MAX_BYTES && quality > 40) {
    quality -= 10;
    output = await sharp(file.buffer)
      .rotate()
      .webp({ quality, effort: 4 })
      .toBuffer();
  }

  if (output.length > MAX_BYTES) {
    const err = new Error('Unable to save image as WebP under 2MB. Please upload a smaller image.');
    err.status = 400;
    throw err;
  }

  const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.promises.writeFile(filepath, output);

  return `/uploads/${filename}`;
};

const removeUploadedFile = async (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string') return;
  if (!publicPath.startsWith('/uploads/')) return;

  const filename = path.basename(publicPath);
  const filepath = path.join(UPLOAD_DIR, filename);
  try {
    await fs.promises.unlink(filepath);
  } catch (_) {
    // ignore missing files
  }
};

module.exports = {
  UPLOAD_DIR,
  MAX_BYTES,
  uploadUniversityMedia,
  saveUniversityImageAsWebp,
  removeUploadedFile,
};
