import React, { useState, useEffect, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export default function MyPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const { playSong } = useContext(AudioContext);

  // Charger les playlists de l'utilisateur (ID temporaire 1)
  const fetchPlaylists = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/playlists/user/1');
      const data = await res.json();
      if (res.ok) {
        setPlaylists(data);
      }
    } catch (err) {
      console.error("Erreur de chargement des playlists", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  // 1. Écouter une playlist complète en continu
  const handlePlayPlaylist = (playlist) => {
    if (playlist.songs.length === 0) return alert("Cette playlist est vide !");
    // On lance le premier morceau et on transmet tout le reste du tableau pour la file d'attente
    playSong(playlist.songs[0], playlist.songs);
  };

  // 2. Télécharger le package ZIP complet
  const handleDownloadZip = (playlistId, playlistName) => {
    // Redirection directe du navigateur vers l'API qui renvoie le flux ZIP
    window.location.href = `http://localhost:5000/api/playlists/${playlistId}/download`;
  };

  if (loading) return <p style={{ padding: '20px' }}>Chargement de vos espaces personnels...</p>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Mes Playlists Enregistrées</h2>

      {playlists.length === 0 ? (
        <p style={{ color: '#666' }}>Tu n'as pas encore créé ou validé de playlist automatique.</p>
      ) : (
        <div style={styles.grid}>
          {playlists.map((playlist) => {
            // Calculer la durée totale de la playlist en minutes
            const totalDurationSec = playlist.songs.reduce((sum, s) => sum + s.duration, 0);
            const totalMinutes = Math.floor(totalDurationSec / 60);

            return (
              <div key={playlist.id} style={styles.card}>
                <h3 style={styles.playlistTitle}>📁 {playlist.name}</h3>
                <p style={styles.metaText}>
                  <strong>Créée le :</strong> {new Date(playlist.created_at).toLocaleDateString()}<br />
                  <strong>Nombre de titres :</strong> {playlist.songs.length}<br />
                  <strong>Durée totale :</strong> {totalMinutes} min
                </p>

                {/* Mini-liste des morceaux inclus (Aperçu des 3 premiers titres) */}
                <div style={styles.trackPreview}>
                  <strong style={{ fontSize: '12px', color: '#555' }}>Au programme :</strong>
                  <ul style={{ paddingLeft: '20px', margin: '5px 0', fontSize: '13px' }}>
                    {playlist.songs.slice(0, 3).map((song, idx) => (
                      <li key={song.id}>{song.title} <span style={{ color: '#777' }}>- {song.artist}</span></li>
                    ))}
                    {playlist.songs.length > 3 && <li>... et {playlist.songs.length - 3} autres morceaux</li>}
                  </ul>
                </div>

                {/* Boutons d'action */}
                <div style={styles.actions}>
                  <button 
                    onClick={() => handlePlayPlaylist(playlist)} 
                    style={styles.playBtn}
                  >
                    ▶ Lancer l'Écoute
                  </button>
                  <button 
                    onClick={() => handleDownloadZip(playlist.id, playlist.name)} 
                    style={styles.downloadBtn}
                  >
                    📦 Télécharger ZIP
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  grid: {
    display: 'block', // Utilisation de blocs fluides compatibles tout environnement
    marginTop: '20px'
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
  },
  playlistTitle: {
    margin: '0 0 10px 0',
    color: '#282c34'
  },
  metaText: {
    fontSize: '14px',
    color: '#444',
    lineHeight: '1.5'
  },
  trackPreview: {
    backgroundColor: '#f5f5f5',
    padding: '10px',
    borderRadius: '4px',
    margin: '15px 0'
  },
  actions: {
    marginTop: '15px'
  },
  playBtn: {
    backgroundColor: '#1DB954',
    color: 'white',
    border: 'none',
    padding: '8px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px',
    fontWeight: 'bold'
  },
  downloadBtn: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '8px 15px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};