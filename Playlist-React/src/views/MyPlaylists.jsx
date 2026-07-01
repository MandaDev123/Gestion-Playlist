import { useState, useEffect, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { AuthContext } from '../context/AuthContext';

export default function MyPlaylists() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedToMerge, setSelectedToMerge] = useState([]); // NOUVEL ÉTAT : Playlists sélectionnées pour la fusion
  const { playSong } = useContext(AudioContext);
  const { authFetch } = useContext(AuthContext);

  const fetchPlaylists = async () => {
    try {
      // authFetch ajoute automatiquement le token de l'utilisateur connecté
      const res = await authFetch('http://localhost:5000/api/playlists/mine');
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

  const handlePlayPlaylist = (playlist) => {
    if (playlist.songs.length === 0) return alert("Cette playlist est vide !");
    playSong(playlist.songs[0], playlist.songs);
  };

  const handleDownloadZip = (playlistId) => {
    window.location.href = `http://localhost:5000/api/playlists/${playlistId}/download`;
  };

  const handleDeletePlaylist = async (playlistId, playlistName) => {
    if (window.confirm(`Voulez-vous vraiment supprimer la playlist "${playlistName}" ?`)) {
      try {
        const res = await authFetch(`http://localhost:5000/api/playlists/${playlistId}`, {
          method: 'DELETE',
        });
        
        if (res.ok) {
          setPlaylists(playlists.filter(p => p.id !== playlistId));
          // Si la playlist supprimée était sélectionnée pour la fusion, on la retire
          setSelectedToMerge(selectedToMerge.filter(id => id !== playlistId));
        } else {
          const errorData = await res.json();
          alert(errorData.error || "Une erreur est survenue lors de la suppression.");
        }
      } catch (err) {
        console.error("Erreur de communication avec l'API", err);
        alert("Impossible de joindre le serveur.");
      }
    }
  };

  const handleRemoveSong = async (playlistId, songId, songTitle) => {
    if (window.confirm(`Retirer le morceau "${songTitle}" de cette playlist ?`)) {
      try {
        const res = await authFetch(`http://localhost:5000/api/playlists/${playlistId}/songs/${songId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          setPlaylists(playlists.map(playlist => {
            if (playlist.id === playlistId) {
              return {
                ...playlist,
                songs: playlist.songs.filter(song => song.id !== songId)
              };
            }
            return playlist;
          }));
        } else {
          const errorData = await res.json();
          alert(errorData.error || "Impossible de retirer ce morceau.");
        }
      } catch (err) {
        console.error("Erreur réseau :", err);
        alert("Erreur de communication avec le serveur.");
      }
    }
  };

  // NOUVELLE FONCTION : Gestion de la fusion
  const handleMergePlaylists = async () => {
    const name = prompt("Entrez un nom pour votre nouvelle playlist fusionnée :");
    if (!name) return; // Annulation de l'utilisateur

    try {
      const res = await authFetch('http://localhost:5000/api/playlists/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, playlist_ids: selectedToMerge }) // user_id géré côté serveur via le token
      });

      if (res.ok) {
        alert(`Playlist "${name}" créée avec succès à partir de vos sélections !`);
        setSelectedToMerge([]); // Réinitialise la sélection
        fetchPlaylists(); // Recharge les playlists pour afficher la nouvelle
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Erreur lors de la fusion.");
      }
    } catch (err) {
      console.error("Erreur lors de la fusion", err);
      alert("Impossible de joindre le serveur pour la fusion.");
    }
  };

  // Gère la sélection d'une checkbox
  const toggleSelection = (playlistId) => {
    if (selectedToMerge.includes(playlistId)) {
      setSelectedToMerge(selectedToMerge.filter(id => id !== playlistId));
    } else {
      setSelectedToMerge([...selectedToMerge, playlistId]);
    }
  };

  if (loading) {
    return (
      <div style={styles.centerContainer}>
        <div style={styles.spinner}></div>
        <p style={styles.loadingText}>Chargement de vos espaces personnels...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>Mes Playlists Enregistrées</h2>
        <p style={styles.subtitle}>Retrouvez et gérez vos sélections musicales personnalisées</p>
      </header>

      {playlists.length > 0 && (
        <div style={styles.mergeControls}>
          <span style={styles.mergeHelper}>
            {selectedToMerge.length} playlist(s) sélectionnée(s) pour la fusion
          </span>
          <button 
            onClick={handleMergePlaylists}
            disabled={selectedToMerge.length < 2}
            style={{
              ...styles.mergeBtn,
              opacity: selectedToMerge.length < 2 ? 0.5 : 1,
              cursor: selectedToMerge.length < 2 ? 'not-allowed' : 'pointer'
            }}
          >
            🔀 Fusionner la sélection
          </button>
        </div>
      )}

      {playlists.length === 0 ? (
        <div style={styles.emptyState}>
          <span style={styles.emptyIcon}>🎵</span>
          <p style={styles.emptyText}>Tu n'as pas encore créé ou validé de playlist automatique.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {playlists.map((playlist) => {
            const totalDurationSec = playlist.songs.reduce((sum, s) => sum + s.duration, 0);
            const totalMinutes = Math.floor(totalDurationSec / 60);
            const isSelected = selectedToMerge.includes(playlist.id);

            return (
              <div key={playlist.id} style={{
                ...styles.card,
                borderColor: isSelected ? '#1DB954' : '#282828', // Met en évidence la carte si sélectionnée
                boxShadow: isSelected ? '0 0 10px rgba(29, 185, 84, 0.3)' : '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <div style={styles.cardHeader}>
                  <div style={styles.titleWithCheckbox}>
                    <input 
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(playlist.id)}
                      style={styles.checkbox}
                      title="Sélectionner pour fusionner"
                    />
                    <h3 style={styles.playlistTitle}>📁 {playlist.name}</h3>
                  </div>
                  <button 
                    onClick={() => handleDeletePlaylist(playlist.id, playlist.name)}
                    style={styles.deleteBtn}
                    title="Supprimer la playlist définitivement"
                  >
                    🗑️
                  </button>
                </div>

                <p style={styles.metaText}>
                  <span>📅 {new Date(playlist.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>🎶 {playlist.songs.length} titres</span>
                  <span>•</span>
                  <span>⏱️ {totalMinutes} min</span>
                </p>

                <div style={styles.trackPreview}>
                  <span style={styles.previewTitle}>Au programme :</span>
                  <ul style={styles.trackList}>
                    {playlist.songs.map((song) => (
                      <li key={song.id} style={styles.trackItem}>
                        <div style={styles.songDetails}>
                          <span style={styles.songTitle}>{song.title}</span>
                          <span style={styles.songArtist}> - {song.artist}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSong(playlist.id, song.id, song.title)}
                          style={styles.removeSongBtn}
                          title="Retirer de la playlist"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                    {playlist.songs.length === 0 && (
                      <li style={{color: '#a7a7a7', fontSize: '13px', fontStyle: 'italic', padding: '6px 0'}}>
                        Aucun morceau dans cette playlist.
                      </li>
                    )}
                  </ul>
                </div>

                <div style={styles.actions}>
                  <button 
                    onClick={() => handlePlayPlaylist(playlist)} 
                    style={styles.playBtn}
                    disabled={playlist.songs.length === 0}
                  >
                    ▶ Lancer l'Écoute
                  </button>
                  <button 
                    onClick={() => handleDownloadZip(playlist.id)} 
                    style={styles.downloadBtn}
                    disabled={playlist.songs.length === 0}
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
  container: { padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#ffffff', backgroundColor: '#121212', minHeight: '100vh' },
  header: { marginBottom: '30px', borderBottom: '1px solid #282828', paddingBottom: '20px' },
  title: { fontSize: '28px', fontWeight: '700', margin: '0 0 8px 0', background: 'linear-gradient(45deg, #1DB954, #00b4db)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { fontSize: '15px', color: '#b3b3b3', margin: 0 },
  centerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#121212', color: '#ffffff' },
  loadingText: { marginTop: '15px', color: '#b3b3b3', fontSize: '16px' },
  spinner: { width: '40px', height: '40px', border: '4px solid #282828', borderTop: '4px solid #1DB954', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  
  // -- NOUVEAUX STYLES POUR LA FUSION --
  mergeControls: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#181818', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #282828' },
  mergeHelper: { color: '#b3b3b3', fontSize: '14px', fontWeight: '500' },
  mergeBtn: { backgroundColor: '#00b4db', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s ease' },
  titleWithCheckbox: { display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', maxWidth: '85%' },
  checkbox: { width: '18px', height: '18px', cursor: 'pointer', accentColor: '#1DB954', flexShrink: 0 },
  // ------------------------------------

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' },
  card: { backgroundColor: '#181818', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', border: '1px solid #282828', transition: 'all 0.2s' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  playlistTitle: { margin: 0, fontSize: '18px', color: '#ffffff', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  deleteBtn: { background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', opacity: 0.6, padding: '4px' },
  metaText: { fontSize: '13px', color: '#b3b3b3', display: 'flex', gap: '8px', margin: '0 0 16px 0', alignItems: 'center' },
  trackPreview: { backgroundColor: '#242424', padding: '14px', borderRadius: '8px', marginBottom: '20px' },
  previewTitle: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#a7a7a7', fontWeight: '700', display: 'block', marginBottom: '8px' },
  trackList: { listStyle: 'none', padding: 0, margin: 0 },
  
  trackItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid #2a2a2a' },
  songDetails: { display: 'flex', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' },
  songTitle: { color: '#ffffff', fontWeight: '500' },
  songArtist: { color: '#b3b3b3', marginLeft: '4px' },
  removeSongBtn: { background: 'none', border: 'none', color: '#a7a7a7', fontSize: '12px', cursor: 'pointer', padding: '0 4px', transition: 'color 0.2s' },
  
  actions: { display: 'flex', gap: '12px', marginTop: 'auto' },
  playBtn: { backgroundColor: '#1DB954', color: '#ffffff', border: 'none', padding: '10px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', flex: 1 },
  downloadBtn: { backgroundColor: 'transparent', color: '#ffffff', border: '1px solid #727272', padding: '10px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' },
  emptyState: { textAlign: 'center', padding: '60px 20px', backgroundColor: '#181818', borderRadius: '12px', border: '1px dashed #282828', marginTop: '40px' },
  emptyIcon: { fontSize: '48px', display: 'block', marginBottom: '16px' },
  emptyText: { color: '#a7a7a7', fontSize: '15px', margin: 0 }
};