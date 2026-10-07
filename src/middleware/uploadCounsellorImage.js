const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const UPLOAD_DIR = path.join(__dirname, '../../upload');
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for profile_img'));
    }
    return cb(null, true);
  },
});

const multerSingle = upload.single('profile_img');

const uploadCounsellorImage = (req, res, next) => {
  multerSingle(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Image must be under 2MB' });
    }
    return res.status(400).json({ message: err.message || 'Invalid image upload' });
  });
};

/**
 * Convert an uploaded image buffer to a square-ish WebP (<= 2MB) and save under /upload.
 * Returns a public path like `/uploads/counsellor-<ts>.webp`.
 */
const saveCounsellorImageAsWebp = async (file) => {
  if (!file?.buffer) return null;

  const encode = (quality) =>
    sharp(file.buffer)
      .rotate()
      .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality, effort: 4 })
      .toBuffer();

  let quality = 82;
  let output = await encode(quality);
  while (output.length > MAX_BYTES && quality > 40) {
    quality -= 10;
    output = await encode(quality);
  }

  if (output.length > MAX_BYTES) {
    const err = new Error('Unable to save image under 2MB. Please upload a smaller image.');
    err.status = 400;
    throw err;
  }

  const filename = `counsellor-${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, filename), output);
  return `/uploads/${filename}`;
};

const removeCounsellorImage = async (publicPath) => {
  if (!publicPath || typeof publicPath !== 'string' || !publicPath.startsWith('/uploads/')) return;
  try {
    await fs.promises.unlink(path.join(UPLOAD_DIR, path.basename(publicPath)));
  } catch (_) {
    // ignore missing files
  }
};

module.exports = {
  uploadCounsellorImage,
  saveCounsellorImageAsWebp,
  removeCounsellorImage,
};
