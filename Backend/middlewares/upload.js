// middlewares/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// S'assurer que le dossier uploads existe
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Génère un nom unique : timestamp-nom_origine
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtrer pour n'accepter que les fichiers audio (MP3)
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
    cb(null, true);
  } else {
    cb(new Error('Seuls les fichiers MP3 sont autorisés !'), false);
  }
};

const upload = multer({ storage: storage, fileFilter: fileFilter });
module.exports = upload;