-- ============================================================
-- SCHEMA POSTGRESQL — Application de gestion de playlists MP3
-- ============================================================
-- Ce script crée les 4 tables principales du projet :
--   1. users           -> les utilisateurs de l'application
--   2. songs           -> les morceaux MP3 et leurs métadonnées
--   3. playlists       -> les playlists créées (manuelles ou générées)
--   4. playlist_songs  -> table de liaison playlist <-> morceaux
--                         (avec gestion de l'ordre des morceaux)
-- ============================================================


-- ------------------------------------------------------------
-- 1. TABLE users
-- ------------------------------------------------------------
-- Chaque utilisateur possède son propre espace de playlists.
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);


-- ------------------------------------------------------------
-- 2. TABLE songs
-- ------------------------------------------------------------
-- Stocke les métadonnées de chaque morceau MP3.
-- Le fichier audio réel est stocké sur le serveur (ex: dossier
-- "uploads/"), seul son chemin relatif est enregistré ici.
CREATE TABLE songs (
    id                  SERIAL PRIMARY KEY,
    title               VARCHAR(255) NOT NULL,
    artist              VARCHAR(255),
    album               VARCHAR(255),
    genre               VARCHAR(100),
    language            VARCHAR(50),
    release_date        DATE,                  -- année / date de sortie
    comment             TEXT,
    duration            INTEGER NOT NULL,       -- durée en secondes (facilite les calculs)
    file_path           VARCHAR(500) NOT NULL,  -- ex: "uploads/3f2a1b-titre.mp3"
    file_size           BIGINT,                 -- taille en octets (optionnel)
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Index pour accélérer les filtres utilisés lors de la génération
-- automatique de playlists (genre, artiste, album, langue).
CREATE INDEX idx_songs_genre    ON songs(genre);
CREATE INDEX idx_songs_artist   ON songs(artist);
CREATE INDEX idx_songs_album    ON songs(album);
CREATE INDEX idx_songs_language ON songs(language);
CREATE INDEX idx_songs_date     ON songs(release_date);


-- ------------------------------------------------------------
-- 3. TABLE playlists
-- ------------------------------------------------------------
-- Une playlist appartient à un seul utilisateur.
-- generation_criteria garde une trace des critères utilisés si
-- la playlist a été générée automatiquement (utile pour historique
-- ou pour permettre de "régénérer" plus tard).
CREATE TABLE playlists (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_generated            BOOLEAN DEFAULT FALSE,
    generation_criteria     JSONB,   -- ex: {"genre":"Pop","artist":"Adele","target_duration":3600}
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_playlists_user ON playlists(user_id);


-- ------------------------------------------------------------
-- 4. TABLE playlist_songs (table de liaison)
-- ------------------------------------------------------------
-- Relie les morceaux à une playlist, et stocke leur position
-- (position) pour permettre la réorganisation par l'utilisateur.
CREATE TABLE playlist_songs (
    id           SERIAL PRIMARY KEY,
    playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id      INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,   -- ordre du morceau dans la playlist (0, 1, 2, ...)
    added_at     TIMESTAMP DEFAULT NOW(),
    UNIQUE (playlist_id, song_id)    -- un même morceau ne peut pas être ajouté 2x à la même playlist
);

CREATE INDEX idx_playlist_songs_playlist ON playlist_songs(playlist_id);
CREATE INDEX idx_playlist_songs_song     ON playlist_songs(song_id);


-- ------------------------------------------------------------
-- 5. Mise à jour automatique de "updated_at"
-- ------------------------------------------------------------
-- Petite fonction + triggers pour que updated_at se mette à jour
-- automatiquement à chaque UPDATE, sans y penser côté backend.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_songs_updated_at
    BEFORE UPDATE ON songs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_playlists_updated_at
    BEFORE UPDATE ON playlists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();