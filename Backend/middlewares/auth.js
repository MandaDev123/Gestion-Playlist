// middlewares/auth.js
const jwt = require('jsonwebtoken');

// IMPORTANT : en production, mets JWT_SECRET dans ton fichier .env
// (le fallback ci-dessous n'est là que pour éviter un crash en développement)
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret_in_env_file';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Authentification requise. Merci de vous connecter." });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // contient { id, username }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session invalide ou expirée. Merci de vous reconnecter." });
  }
}

module.exports = { authMiddleware, JWT_SECRET };