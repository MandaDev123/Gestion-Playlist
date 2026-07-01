// server.js - TOUT EN HAUT DU FICHIER
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const db = require('./config/db');
const upload = require('./middlewares/upload');
const archiver = require('archiver'); // 4. Instancier l'archive de manière sécurisée
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware, JWT_SECRET } = require('./middlewares/auth');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
// Permet de rendre le dossier uploads public pour que React puisse lire les fichiers audio
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==========================================
// ROUTES API (AUTHENTIFICATION)
// ==========================================

// POST /api/auth/register -> Créer un compte utilisateur
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Nom d'utilisateur, email et mot de passe requis." });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Un compte existe déjà avec cet email ou ce nom d'utilisateur." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, passwordHash]
    );
    const user = result.rows[0];

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ message: "Compte créé avec succès !", token, user });
  } catch (error) {
    console.error("Erreur lors de l'inscription :", error);
    res.status(500).json({ error: "Erreur serveur lors de l'inscription." });
  }
});

// POST /api/auth/login -> Connexion
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis." });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Email ou mot de passe incorrect." });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: "Connexion réussie !",
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });
  } catch (error) {
    console.error("Erreur lors de la connexion :", error);
    res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
});

// GET /api/auth/me -> Vérifie le token et renvoie l'utilisateur courant (utile au rechargement de page)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const result = await db.query('SELECT id, username, email FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// ==========================================
// ROUTES API (CRUD - SONGS)
// ==========================================

// 1. POST /api/songs -> Upload d'un fichier + Extraction + Insertion BDD
app.post('/api/songs', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier audio fourni ou format invalide." });
    }

    const filePath = req.file.path.replace(/\\/g, '/'); // Normalise le chemin pour le web
    const fileSize = req.file.size;

    // Utilisation des métadonnées envoyées par le programme Java via FormData
    let meta = {};
    if (req.body.metadata) {
      try {
        meta = JSON.parse(req.body.metadata);
      } catch (e) {
        console.error("Erreur de parsing des métadonnées JSON :", e);
      }
    }
    
    // Utilisation des valeurs fournies par Java ou valeurs par défaut
    const title = (meta.title && meta.title !== "Inconnu") ? meta.title : req.file.originalname.replace('.mp3', '');
    const artist = meta.artist || 'Artiste Inconnu';
    const album = meta.album || 'Album Inconnu';
    const genre = meta.genre || 'Inconnu';
    const language = 'Inconnu'; // Souvent non présent dans les tags ID3 standards
    const comment = meta.comment || '';
    
    // Durée en secondes
    const duration = meta.duration || 0;
    
    // Date de sortie
    let releaseDate = null;
    if (meta.year && meta.year !== "Inconnue") {
      const yearMatch = String(meta.year).match(/\d{4}/);
      if (yearMatch) {
        releaseDate = `${yearMatch[0]}-01-01`; // Format DATE valide pour Postgres
      }
    }

    // Insertion en base de données
    const queryText = `
      INSERT INTO songs (title, artist, album, genre, language, release_date, comment, duration, file_path, file_size)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [title, artist, album, genre, language, releaseDate, comment, duration, filePath, fileSize];
    
    const result = await db.query(queryText, values);
    
    res.status(201).json({ message: "Morceau ajouté avec succès !", song: result.rows[0] });

  } catch (error) {
    console.error("Erreur lors de l'upload :", error);
    res.status(500).json({ error: "Erreur serveur lors du traitement du fichier." });
  }
});

// 2. GET /api/songs -> Récupérer la liste de tous les morceaux
app.get('/api/songs', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM songs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des morceaux." });
  }
});

// GET /api/songs/genres -> Récupérer la liste des genres distincts réellement présents en base
// (utilisé pour peupler dynamiquement le formulaire de génération de playlist)
app.get('/api/songs/genres', async (req, res) => {
  try {
    // Certaines chansons ont plusieurs genres dans une seule chaîne (ex: "filmscore, trailer").
    // On les sépare avec unnest(string_to_array(...)) pour obtenir des genres individuels et uniques.
    const result = await db.query(
      `SELECT DISTINCT TRIM(genre_part) AS genre
       FROM songs, LATERAL unnest(string_to_array(genre, ',')) AS genre_part
       WHERE genre IS NOT NULL AND TRIM(genre_part) != ''
       ORDER BY genre ASC`
    );
    const genres = result.rows.map(row => row.genre);
    res.json(genres);
  } catch (error) {
    console.error("Erreur lors de la récupération des genres :", error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des genres." });
  }
});

app.get('/api/playlists', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM playlists ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la récupération des morceaux." });
  }
});

// 3. PUT /api/songs/:id -> Modifier manuellement les métadonnées
app.put('/api/songs/:id', async (req, res) => {
  const { id } = req.params;
  const { title, artist, album, genre, language, release_date, comment, duration } = req.body;

  try {
    const queryText = `
      UPDATE songs 
      SET title = $1, artist = $2, album = $3, genre = $4, language = $5, release_date = $6, comment = $7, duration = $8
      WHERE id = $9
      RETURNING *;
    `;
    const values = [title, artist, album, genre, language, release_date, comment, duration, id];
    const result = await db.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Morceau introuvable." });
    }

    res.json({ message: "Métadonnées mises à jour !", song: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la modification." });
  }
});

// 4. DELETE /api/songs/:id -> Supprimer le fichier physique ET la ligne en BDD
app.delete('/api/songs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Récupérer le chemin du fichier avant de supprimer la ligne
    const songResult = await db.query('SELECT file_path FROM songs WHERE id = $1', [id]);
    
    if (songResult.rows.length === 0) {
      return res.status(404).json({ error: "Morceau introuvable." });
    }

    const filePath = songResult.rows[0].file_path;

    // 1. Suppression en BDD
    await db.query('DELETE FROM songs WHERE id = $1', [id]);

    // 2. Suppression du fichier physique sur le serveur
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: "Morceau et fichier supprimés avec succès !" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
});

// POST /api/playlists/generate -> Génère une playlist temporaire selon des critères
// server.js (Route de génération modifiée)
app.post('/api/playlists/generate', async (req, res) => {
  // Récupération des nouveaux critères
  const { genres, artist, album, language, yearMin, yearMax, target_duration } = req.body;

  if (!target_duration || target_duration <= 0) {
    return res.status(400).json({ error: "Une durée totale souhaitée est requise." });
  }

  try {
    let queryText = 'SELECT * FROM songs WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // 1. Gestion du multi-genre : une chanson peut avoir plusieurs genres dans une seule
    // chaîne (ex: "filmscore, trailer"), donc on découpe cette chaîne et on vérifie si
    // au moins un des genres sélectionnés par l'utilisateur s'y trouve.
    if (genres && Array.isArray(genres) && genres.length > 0) {
      queryText += ` AND EXISTS (
        SELECT 1 FROM unnest(string_to_array(songs.genre, ',')) AS g(genre_value)
        WHERE TRIM(g.genre_value) = ANY($${paramIndex})
      )`;
      queryParams.push(genres);
      paramIndex++;
    }

    if (artist) {
      queryText += ` AND artist = $${paramIndex}`;
      queryParams.push(artist);
      paramIndex++;
    }
    
    if (album) {
      queryText += ` AND album = $${paramIndex}`;
      queryParams.push(album);
      paramIndex++;
    }
    
    if (language) {
      queryText += ` AND language = $${paramIndex}`;
      queryParams.push(language);
      paramIndex++;
    }

    // 2. Gestion de la plage de dates (Année Min / Max)
    if (yearMin) {
      queryText += ` AND EXTRACT(YEAR FROM release_date) >= $${paramIndex}`;
      queryParams.push(parseInt(yearMin));
      paramIndex++;
    }
    
    if (yearMax) {
      queryText += ` AND EXTRACT(YEAR FROM release_date) <= $${paramIndex}`;
      queryParams.push(parseInt(yearMax));
      paramIndex++;
    }

    // Mélange aléatoire
    queryText += ' ORDER BY RANDOM()';

    // Exécution de la requête PostgreSQL
    const dbResult = await db.query(queryText, queryParams);
    const availableSongs = dbResult.rows;

    // Algorithme de sélection selon la durée (Approche stricte inchangée)
    const generatedPlaylist = [];
    let currentTotalDuration = 0;

    for (const song of availableSongs) {
      if (currentTotalDuration + song.duration > target_duration) {
        continue; 
      }
      generatedPlaylist.push(song);
      currentTotalDuration += song.duration;

      if (currentTotalDuration === target_duration) {
        break;
      }
    }

    res.json({
      meta: {
        total_songs: generatedPlaylist.length,
        total_duration_seconds: currentTotalDuration,
        target_duration_seconds: target_duration
      },
      songs: generatedPlaylist
    });

  } catch (error) {
    console.error("Erreur lors de la génération de la playlist :", error);
    res.status(500).json({ error: "Erreur serveur lors de la génération." });
  }
});

// POST /api/playlists -> Sauvegarder définitivement une playlist validée
app.post('/api/playlists', authMiddleware, async (req, res) => {
  const { name, is_generated, generation_criteria, song_ids } = req.body;
  const user_id = req.user.id; // On ne fait plus confiance au user_id envoyé par le client

  if (!name || !song_ids || !Array.isArray(song_ids)) {
    return res.status(400).json({ error: "Données de playlist incomplètes ou invalides." });
  }

  try {
    // Étape 1 : Commencer une transaction SQL (pour s'assurer que tout s'enregistre correctement)
    await db.query('BEGIN');

    // Étape 2 : Insérer la playlist dans la table `playlists`
    const playlistQuery = `
      INSERT INTO playlists (name, user_id, is_generated, generation_criteria)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    const playlistValues = [name, user_id, is_generated || false, JSON.stringify(generation_criteria || {})];
    const playlistResult = await db.query(playlistQuery, playlistValues);
    const playlistId = playlistResult.rows[0].id;

    // Étape 3 : Insérer les morceaux associés dans la table de liaison `playlist_songs`
    // en préservant l'ordre exact envoyé par le frontend (grâce à l'index `position`)
    const songLinkQuery = `
      INSERT INTO playlist_songs (playlist_id, song_id, position)
      VALUES ($1, $2, $3);
    `;

    for (let position = 0; position < song_ids.length; position++) {
      const songId = song_ids[position];
      await db.query(songLinkQuery, [playlistId, songId, position]);
    }

    // Tout s'est bien passé, on valide la transaction
    await db.query('COMMIT');

    res.status(201).json({ 
      message: "Playlist enregistrée avec succès !", 
      playlistId: playlistId 
    });

  } catch (error) {
    // En cas d'erreur, on annule toutes les insertions de la transaction
    await db.query('ROLLBACK');
    console.error("Erreur lors de la sauvegarde de la playlist :", error);
    res.status(500).json({ error: "Erreur serveur lors de la sauvegarde." });
  }
});

// GET /api/songs/:id/stream -> Streamer un morceau MP3 avec gestion du déplacement (Range)
app.get('/api/songs/:id/stream', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('SELECT file_path FROM songs WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Morceau introuvable." });
    }

    const filePath = result.rows[0].file_path;

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier audio physique manquant sur le serveur." });
    }

    const stat = fs.statSync(filePath);
    const totalSize = stat.size;
    const range = req.headers.range;

    // Si le navigateur demande une partie spécifique du fichier (Streaming/Seeking)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = (end - start) + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const headers = {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'audio/mpeg',
      };

      res.writeHead(206, headers); // 206 = Partial Content
      fileStream.pipe(res);
    } else {
      // Si aucune plage n'est demandée, on envoie le fichier entier
      const headers = {
        'Content-Length': totalSize,
        'Content-Type': 'audio/mpeg',
      };
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }

  } catch (error) {
    console.error("Erreur de streaming :", error);
    res.status(500).json({ error: "Erreur lors de la lecture du flux audio." });
  }
});

// const archiver = require('archiver');
// GET /api/playlists/:id/download -> Télécharger une playlist complète au format ZIP
app.get('/api/playlists/:id/download', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Récupérer les infos de la playlist
    const playlistResult = await db.query('SELECT name FROM playlists WHERE id = $1', [id]);
    if (playlistResult.rows.length === 0) {
      return res.status(404).json({ error: "Playlist introuvable." });
    }
    
    // Normalisation du nom de fichier pour le ZIP
    const playlistName = playlistResult.rows[0].name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    // 2. Récupérer la liste des morceaux associés ordonnés par leur position
    const songsQuery = `
      SELECT s.file_path, s.title, s.artist 
      FROM songs s
      JOIN playlist_songs ps ON s.id = ps.song_id
      WHERE ps.playlist_id = $1
      ORDER BY ps.position ASC;
    `;
    const songsResult = await db.query(songsQuery, [id]);
    const songs = songsResult.rows;

    if (songs.length === 0) {
      return res.status(400).json({ error: "Cette playlist ne contient aucun morceau." });
    }

    // 3. Configurer les headers HTTP pour indiquer qu'on envoie un fichier ZIP téléchargeable
    res.attachment(`${playlistName}.zip`);
    res.setHeader('Content-Type', 'application/zip');

    // 4. Initialiser le processus de compression d'archiver selon sa structure ESM détectée
    let archive;
    if (archiver && archiver.ZipArchive) {
      // Cas détecté dans vos logs : instanciation de la classe ZipArchive exposée
      archive = new archiver.ZipArchive({ zlib: { level: 5 } });
    } else if (typeof archiver === 'function') {
      // Cas standard classique (Secours)
      archive = archiver('zip', { zlib: { level: 5 } });
    } else if (archiver && typeof archiver.create === 'function') {
      // Autre format usine standard (Secours)
      archive = archiver.create('zip', { zlib: { level: 5 } });
    } else {
      throw new TypeError("Impossible d'initialiser le module 'archiver' avec la structure détectée.");
    }

    // Écouter les erreurs potentielles d'archiver
    archive.on('error', (err) => {
      console.error("Erreur Archiver:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Erreur lors de la création du ZIP" });
      }
    });

    // Événement une fois que toutes les données ont été envoyées à la réponse
    res.on('finish', () => {
      console.log(`Téléchargement du ZIP terminé avec succès pour la playlist ID: ${id}`);
    });

    // Rediriger le flux de l'archive directement vers la réponse HTTP
    archive.pipe(res);

    // 5. Ajouter chaque fichier MP3 à l'archive
    songs.forEach((song, index) => {
      if (fs.existsSync(song.file_path)) {
        const cleanTitle = song.title.replace(/[^a-z0-9]/gi, '_');
        const cleanArtist = song.artist ? song.artist.replace(/[^a-z0-9]/gi, '_') : 'Inconnu';
        const zipFileName = `${String(index + 1).padStart(2, '0')}-${cleanTitle}-${cleanArtist}.mp3`;

        archive.file(song.file_path, { name: zipFileName });
      } else {
        console.warn(`Fichier manquant sur le serveur : ${song.file_path}`);
      }
    });

    // 6. Finaliser l'archive 
    archive.finalize();

  } catch (error) {
    console.error("Erreur lors de la génération du ZIP :", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur serveur lors de la création du fichier ZIP." });
    }
  }
});

// GET /api/playlists/mine -> Récupérer toutes les playlists de l'utilisateur connecté avec leurs morceaux
app.get('/api/playlists/mine', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Récupérer les playlists de l'utilisateur
    const playlistsResult = await db.query(
      'SELECT * FROM playlists WHERE user_id = $1 ORDER BY created_at DESC', 
      [userId]
    );
    const playlists = playlistsResult.rows;

    // 2. Pour chaque playlist, aller chercher ses morceaux associés respectant l'ordre (position)
    const fullPlaylists = [];
    for (const playlist of playlists) {
      const songsQuery = `
        SELECT s.* FROM songs s
        JOIN playlist_songs ps ON s.id = ps.song_id
        WHERE ps.playlist_id = $1
        ORDER BY ps.position ASC;
      `;
      const songsResult = await db.query(songsQuery, [playlist.id]);
      
      fullPlaylists.push({
        ...playlist,
        songs: songsResult.rows
      });
    }

    res.json(fullPlaylists);
  } catch (error) {
    console.error("Erreur lors de la récupération des playlists :", error);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des playlists." });
  }
});

// DELETE /api/playlists/:id -> Supprimer définitivement une playlist et ses liaisons
app.delete('/api/playlists/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Vérifie que la playlist appartient bien à l'utilisateur connecté
    const ownerCheck = await db.query('SELECT user_id FROM playlists WHERE id = $1', [id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: "Playlist introuvable." });
    }
    if (ownerCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Vous n'êtes pas autorisé à supprimer cette playlist." });
    }

    // Début d'une transaction pour garantir la suppression propre de tout le bloc
    await db.query('BEGIN');

    // 1. Supprimer d'abord les associations dans la table de liaison playlist_songs
    await db.query('DELETE FROM playlist_songs WHERE playlist_id = $1', [id]);

    // 2. Supprimer la playlist dans la table playlists
    const result = await db.query('DELETE FROM playlists WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: "Playlist introuvable." });
    }

    await db.query('COMMIT');
    res.json({ message: "Playlist supprimée avec succès !" });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error("Erreur lors de la suppression de la playlist :", error);
    res.status(500).json({ error: "Erreur serveur lors de la suppression." });
  }
});



// ==========================================
// NOUVELLES ROUTES : GESTION DES MORCEAUX DANS UNE PLAYLIST
// ==========================================

// 1. Ajouter un morceau à une playlist existante
app.post('/api/playlists/:id/songs', authMiddleware, async (req, res) => {
  const { id } = req.params; // ID de la playlist
  const { song_id } = req.body;

  if (!song_id) {
    return res.status(400).json({ error: "L'ID de la chanson est requis." });
  }

  try {
    // Optionnel : vérifier si la chanson est déjà dans la playlist pour éviter les doublons stricts
    const checkDuplicate = await db.query(
      'SELECT * FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2',
      [id, song_id]
    );
    if (checkDuplicate.rows.length > 0) {
      return res.status(400).json({ error: "Ce morceau est déjà dans la playlist." });
    }

    // Récupérer la dernière position pour insérer à la suite
    const posResult = await db.query(
      'SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = $1',
      [id]
    );
    const position = parseInt(posResult.rows[0].count, 10);

    // Insérer dans la table de liaison
    const insertQuery = `
      INSERT INTO playlist_songs (playlist_id, song_id, position)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    await db.query(insertQuery, [id, song_id, position]);

    // Récupérer les infos complètes du morceau pour les renvoyer au front-end
    const songInfo = await db.query('SELECT * FROM songs WHERE id = $1', [song_id]);

    res.status(201).json({
      message: "Morceau ajouté à la playlist avec succès !",
      song: songInfo.rows[0]
    });
  } catch (error) {
    console.error("Erreur lors de l'ajout du morceau à la playlist :", error);
    res.status(500).json({ error: "Erreur serveur lors de l'ajout." });
  }
});

// 2. Retirer un morceau d'une playlist (sans supprimer la chanson de la BDD générale)
app.delete('/api/playlists/:id/songs/:songId', authMiddleware, async (req, res) => {
  const { id, songId } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2 RETURNING *',
      [id, songId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Ce morceau ne fait pas partie de cette playlist." });
    }

    res.json({ message: "Morceau retiré de la playlist avec succès !" });
  } catch (error) {
    console.error("Erreur lors du retrait du morceau de la playlist :", error);
    res.status(500).json({ error: "Erreur serveur lors du retrait." });
  }
});

// POST /api/playlists/merge -> Fusionner plusieurs playlists en une nouvelle
app.post('/api/playlists/merge', authMiddleware, async (req, res) => {
  const { name, playlist_ids } = req.body;
  const user_id = req.user.id; // On ne fait plus confiance au user_id envoyé par le client

  if (!name || !playlist_ids || playlist_ids.length < 2) {
    return res.status(400).json({ error: "Nom et au moins 2 playlists requis pour la fusion." });
  }

  try {
    // Vérifie que toutes les playlists sélectionnées appartiennent bien à l'utilisateur connecté
    const ownershipCheck = await db.query(
      'SELECT id FROM playlists WHERE id = ANY($1) AND user_id != $2',
      [playlist_ids, user_id]
    );
    if (ownershipCheck.rows.length > 0) {
      return res.status(403).json({ error: "Vous ne pouvez fusionner que vos propres playlists." });
    }

    await db.query('BEGIN');

    // 1. Récupérer tous les IDs de chansons uniques des playlists sélectionnées
    const songsQuery = `
      SELECT DISTINCT song_id 
      FROM playlist_songs 
      WHERE playlist_id = ANY($1)
    `;
    const songsResult = await db.query(songsQuery, [playlist_ids]);
    const songIds = songsResult.rows.map(row => row.song_id);

    // 2. Créer la nouvelle playlist
    const newPlaylist = await db.query(
      'INSERT INTO playlists (name, user_id, is_generated) VALUES ($1, $2, false) RETURNING id',
      [name, user_id]
    );
    const newPlaylistId = newPlaylist.rows[0].id;

    // 3. Ajouter les chansons uniques
    for (let i = 0; i < songIds.length; i++) {
      await db.query(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES ($1, $2, $3)',
        [newPlaylistId, songIds[i], i]
      );
    }

    await db.query('COMMIT');
    res.status(201).json({ message: "Fusion réussie !", newPlaylistId });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: "Erreur lors de la fusion." });
  }
});

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});