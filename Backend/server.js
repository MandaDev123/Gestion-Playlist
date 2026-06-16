// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');
const db = require('./config/db');
const upload = require('./middlewares/upload');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
// Permet de rendre le dossier uploads public pour que React puisse lire les fichiers audio
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

    // Extraction automatique des métadonnées grâce à music-metadata
    const metadata = await mm.parseFile(filePath);
    
    // Valeurs par défaut si les métadonnées sont vides
    const title = metadata.common.title || req.file.originalname.replace('.mp3', '');
    const artist = metadata.common.artist || 'Artiste Inconnu';
    const album = metadata.common.album || 'Album Inconnu';
    const genre = metadata.common.genre ? metadata.common.genre[0] : 'Inconnu';
    const language = 'Inconnu'; // Souvent non présent dans les tags ID3 standards
    const comment = metadata.common.comment ? metadata.common.comment[0] : '';
    
    // Durée arrondie en secondes (essentiel pour tes futurs calculs)
    const duration = metadata.format.duration ? Math.round(metadata.format.duration) : 0;
    
    // Date de sortie
    let releaseDate = null;
    if (metadata.common.year) {
      releaseDate = `${metadata.common.year}-01-01`; // Format DATE valide pour Postgres
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
app.post('/api/playlists/generate', async (req, res) => {
  const { genre, artist, album, language, year, target_duration } = req.body;

  // target_duration doit être convertie en secondes côté frontend (ex: 1h = 3600)
  if (!target_duration || target_duration <= 0) {
    return res.status(400).json({ error: "Une durée totale souhaitée est requise." });
  }

  try {
    let queryText = 'SELECT * FROM songs WHERE 1=1';
    const queryParams = [];
    let paramIndex = 1;

    // Construction dynamique de la clause WHERE selon les critères fournis
    if (genre) {
      queryText += ` AND genre = $${paramIndex}`;
      queryParams.push(genre);
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
    if (year) {
      // Extrait l'année de la colonne release_date
      queryText += ` AND EXTRACT(YEAR FROM release_date) = $${paramIndex}`;
      queryParams.push(parseInt(year));
      paramIndex++;
    }

    // Mélanger aléatoirement les morceaux correspondants directement via PostgreSQL
    queryText += ' ORDER BY RANDOM()';

    // Exécution de la recherche
    const dbResult = await db.query(queryText, queryParams);
    const availableSongs = dbResult.rows;

    // ---- ALGORITHME DE SÉLECTION SELON LA DURÉE ----
    const generatedPlaylist = [];
    let currentTotalDuration = 0;

    for (const song of availableSongs) {
      // Si l'ajout du morceau dépasse la durée cible, on vérifie si on est déjà proche du but
      if (currentTotalDuration + song.duration > target_duration) {
        // Optionnel : On peut accepter le morceau si cela nous rapproche plus de la cible
        // que de s'arrêter net (ex: s'il manque 30s et que le morceau fait 40s).
        // Ici, on choisit une approche stricte : on ne dépasse pas la limite fixée.
        continue; 
      }

      generatedPlaylist.push(song);
      currentTotalDuration += song.duration;

      // Si on a atteint pile la durée, on peut stopper la boucle
      if (currentTotalDuration === target_duration) {
        break;
      }
    }

    // On renvoie la playlist générée ET les critères originaux (pour que le front puisse les afficher ou les stocker)
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
app.post('/api/playlists', async (req, res) => {
  const { name, user_id, is_generated, generation_criteria, song_ids } = req.body;

  if (!name || !user_id || !song_ids || !Array.isArray(song_ids)) {
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

const archiver = require('archiver');

// GET /api/playlists/:id/download -> Télécharger une playlist complète au format ZIP
app.get('/api/playlists/:id/download', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Récupérer les infos de la playlist
    const playlistResult = await db.query('SELECT name FROM playlists WHERE id = $1', [id]);
    if (playlistResult.rows.length === 0) {
      return res.status(404).json({ error: "Playlist introuvable." });
    }
    
    // Normalisation du nom de fichier pour le ZIP (ex: "Playlist Relax")
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

    // 4. Initialiser le processus de compression d'archiver
    const archive = archiver('zip', {
      zlib: { level: 5 } // Niveau de compression intermédiaire (rapide et efficace)
    });

    // Rediriger le flux de l'archive directement vers la réponse HTTP
    archive.pipe(res);

    // Écouter les erreurs potentielles d'archiver
    archive.on('error', (err) => {
      throw err;
    });

    // 5. Ajouter chaque fichier MP3 à l'archive
    songs.forEach((song, index) => {
      if (fs.existsSync(song.file_path)) {
        // Optionnel : renommer proprement le fichier à l'intérieur du ZIP
        // Exemple : "01 - Titre - Artiste.mp3" au lieu du nom barbare de Multer
        const cleanTitle = song.title.replace(/[^a-z0-9]/gi, '_');
        const cleanArtist = song.artist ? song.artist.replace(/[^a-z0-9]/gi, '_') : 'Inconnu';
        const zipFileName = `${String(index + 1).padStart(2, '0')}-${cleanTitle}-${cleanArtist}.mp3`;

        archive.file(song.file_path, { name: zipFileName });
      }
    });

    // 6. Finaliser l'archive (ferme le flux et déclenche le téléchargement côté client)
    await archive.finalize();

  } catch (error) {
    console.error("Erreur lors de la génération du ZIP :", error);
    // On ne peut pas envoyer un JSON d'erreur si les headers de téléchargement ont déjà été envoyés
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur serveur lors de la création du fichier ZIP." });
    }
  }
});

// GET /api/playlists/user/:userId -> Récupérer toutes les playlists d'un utilisateur avec leurs morceaux
app.get('/api/playlists/user/:userId', async (req, res) => {
  const { userId } = req.params;

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

// Lancement du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});