-- Insertion d'utilisateurs
INSERT INTO users (id, username, email, password_hash) VALUES
(1, 'manda_dev', 'manda@ituniversity.mg', '$2b$10$ExAmPlE...HashedPasswordString'),
(2, 'feno_groove', 'feno@mail.com', '$2b$10$HaShEdPa...AnotherHashedPassword');

-- Réajustement de la séquence d'auto-incrément pour la table users
ALTER SEQUENCE users_id_seq RESTART WITH 3;

-- Insertion d'une bibliothèque de morceaux MP3 (durées en secondes)
INSERT INTO songs (id, title, artist, album, genre, language, release_date, comment, duration, file_path, file_size) VALUES
(101, 'Levitating', 'Dua Lipa', 'Future Nostalgia', 'Pop', 'Anglais', '2020-03-27', 'Groove de basse disco-funk moderne', 203, 'uploads/1718-levitating.mp3', 4872000),
(102, 'Rolling in the Deep', 'Adele', '21', 'Pop', 'Anglais', '2011-01-24', 'Hit international', 228, 'uploads/1719-rolling.mp3', 5472000),
(103, 'September', 'Earth, Wind & Fire', 'I Am', 'Disco-Funk', 'Anglais', '1978-11-18', 'Classique intemporel', 215, 'uploads/1720-september.mp3', 5160000),
(104, 'Formidable', 'Stromae', 'Racine Carrée', 'Pop', 'Français', '2013-08-16', 'Chanson à texte', 213, 'uploads/1721-formidable.mp3', 5112000),
(105, 'Someone Like You', 'Adele', '21', 'Pop', 'Anglais', '2011-01-24', 'Ballade piano', 285, 'uploads/1722-someone.mp3', 6840000);

ALTER SEQUENCE songs_id_seq RESTART WITH 106;

-- Insertion d'une playlist validée pour l'utilisateur 1 (manda_dev)
INSERT INTO playlists (id, name, user_id, is_generated, generation_criteria) VALUES
(50, 'My Pop Session', 1, TRUE, '{"genre": "Pop", "target_duration": 600}');

ALTER SEQUENCE playlists_id_seq RESTART WITH 51;

-- Liaison des morceaux à la playlist 50 en respectant l'ordre de position (0, 1, 2)
-- Durée cumulée : 228s + 213s + 203s = 644 secondes (~10 minutes)
INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES
(50, 102, 0), 
(50, 104, 1), 
(50, 101, 2); 