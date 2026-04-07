const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads', 'reels');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.mp4';
    cb(null, `reel-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const isVideo = String(file.mimetype || '').startsWith('video/');
  if (!isVideo) {
    return cb(new Error('Only video files are allowed'));
  }
  return cb(null, true);
};

const uploadReelVideo = multer({
  storage,
  fileFilter,
  limits: { fileSize: 150 * 1024 * 1024 },
});

module.exports = {
  uploadReelVideo,
};
