import  { useState, useEffect, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';
import { AuthContext } from '../context/AuthContext';

export default function PlaylistGenerator() {
  const { playSong } = useContext(AudioContext);
  const { authFetch } = useContext(AuthContext);

  // Genres disponibles, chargés dynamiquement depuis la bibliothèque réelle
  const [availableGenres, setAvailableGenres] = useState([]);
  const [genresLoading, setGenresLoading] = useState(true);

  useEffect(() => {
    const fetchGenres = async () => {
      try {
        const res = await authFetch('http://localhost:5000/api/songs/genres');
        const data = await res.json();
        if (res.ok) {
          setAvailableGenres(data);
        }
      } catch (err) {
        console.error("Erreur lors du chargement des genres", err);
      } finally {
        setGenresLoading(false);
      }
    };
    fetchGenres();
  }, []);

  // États pour les critères du formulaire mis à jour
  const [criteria, setCriteria] = useState({
    genres: [], // Tableau pour stocker la sélection multiple des genres
    artist: '',
    album: '',
    language: '', // Liste déroulante simple
    yearMin: '',  // Borne minimale de la date
    yearMax: '',  // Borne maximale de la date
    targetDurationMinutes: 30 // Saisie en minutes
  });

  // États pour la playlist générée temporairement
  const [generatedSongs, setGeneratedSongs] = useState([]);
  const [playlistMeta, setPlaylistMeta] = useState(null);
  const [playlistName, setPlaylistName] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Gérer les changements des champs de saisie (y compris la sélection multiple)
  const handleChange = (e) => {
    const { name, value, options } = e.target;

    if (name === 'genres') {
      const selectedGenres = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          selectedGenres.push(options[i].value);
        }
      }
      setCriteria({ ...criteria, genres: selectedGenres });
    } else {
      setCriteria({ ...criteria, [name]: value });
    }
  };

  // 1. Déclencher la génération intelligente auprès de l'API
  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsSaved(false);

    // Conversion en secondes pour correspondre aux attentes de server.js
    const bodyData = {
      ...criteria,
      target_duration: criteria.targetDurationMinutes * 60
    };
    delete bodyData.targetDurationMinutes; 

    try {
      const res = await authFetch('http://localhost:5000/api/playlists/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setGeneratedSongs(data.songs);
        setPlaylistMeta(data.meta);
        const genreLabel = criteria.genres.length > 0 ? criteria.genres.join(', ') : 'Mix';
        setPlaylistName(`Ma Playlist Automatique - ${genreLabel}`);
      } else {
        alert(data.error || "Erreur lors de la génération");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Réorganiser la playlist : Déplacer un morceau vers le haut ou vers le bas
  const moveSong = (index, direction) => {
    const updatedSongs = [...generatedSongs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= updatedSongs.length) return;

    const temp = updatedSongs[index];
    updatedSongs[index] = updatedSongs[targetIndex];
    updatedSongs[targetIndex] = temp;

    setGeneratedSongs(updatedSongs);
  };

  // 3. Supprimer un morceau de la playlist temporaire
  const removeSongFromPreview = (index) => {
    const updatedSongs = generatedSongs.filter((_, i) => i !== index);
    setGeneratedSongs(updatedSongs);
    
    const newTotalDuration = updatedSongs.reduce((sum, song) => sum + song.duration, 0);
    setPlaylistMeta({
      ...playlistMeta,
      total_songs: updatedSongs.length,
      total_duration_seconds: newTotalDuration
    });
  };

  // 4. Valider et sauvegarder définitivement en BDD
  const handleSavePlaylist = async () => {
    if (!playlistName.trim()) return alert("Donne un nom à ta playlist !");

    const payload = {
      name: playlistName,
      is_generated: true,
      generation_criteria: criteria,
      song_ids: generatedSongs.map(song => song.id) 
    };

    try {
      const res = await authFetch('http://localhost:5000/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        alert("Playlist enregistrée avec succès dans ton espace !");
        setIsSaved(true);
      } else {
        alert(data.error || "Erreur lors de la sauvegarde");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.viewTitle}>Générateur Intelligent de Playlist</h2>

      {/* Conteneur principal flexible pour éviter les chevauchements et écrasements */}
      <div style={styles.contentLayout}>
        
        {/* Formulaire des critères */}
        <form onSubmit={handleGenerate} style={styles.form}>
          
          {/* Liste déroulante MULTIPLE pour le Genre */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Genre(s) Musical(aux) : <small style={styles.helpText}>(Ctrl / Cmd + Clic)</small></label>
            {genresLoading ? (
              <p style={styles.helpText}>Chargement des genres...</p>
            ) : availableGenres.length === 0 ? (
              <p style={styles.helpText}>Aucun genre trouvé dans ta bibliothèque.</p>
            ) : (
              <select 
                name="genres" 
                multiple 
                value={criteria.genres} 
                onChange={handleChange} 
                style={styles.selectMultiple}
              >
                {availableGenres.map((genre) => (
                  <option key={genre} value={genre}>{genre}</option>
                ))}
              </select>
            )}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Artiste :</label>
            <input type="text" name="artist" value={criteria.artist} onChange={handleChange} placeholder="Ex: Adele, Dua Lipa" style={styles.input} />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Album :</label>
            <input type="text" name="album" value={criteria.album} onChange={handleChange} placeholder="Ex: Future Nostalgia" style={styles.input} />
          </div>

          {/* Plage de dates Min / Max sur une ligne propre */}
          <div style={styles.row}>
            <div style={{ ...styles.formGroup, flex: 1, marginRight: '10px' }}>
              <label style={styles.label}>Année Min :</label>
              <input type="number" name="yearMin" value={criteria.yearMin} onChange={handleChange} placeholder="2010" style={styles.input} />
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label}>Année Max :</label>
              <input type="number" name="yearMax" value={criteria.yearMax} onChange={handleChange} placeholder="2026" style={styles.input} />
            </div>
          </div>

          {/* Liste déroulante pour la Langue */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Langue :</label>
            <select name="language" value={criteria.language} onChange={handleChange} style={styles.select}>
              <option value="">-- Toutes les langues --</option>
              <option value="Anglais">Anglais</option>
              <option value="Français">Français</option>
              <option value="Espagnol">Espagnol</option>
              <option value="Inconnu">Inconnu</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Durée Totale Souhaitée (minutes) :</label>
            <input type="number" name="targetDurationMinutes" value={criteria.targetDurationMinutes} onChange={handleChange} required min="1" style={styles.input} />
          </div>

          <button type="submit" style={styles.generateButton}>Générer la Playlist ✨</button>
        </form>

        {/* Zone de prévisualisation à droite si une playlist est générée */}
        {generatedSongs.length > 0 && (
          <div style={styles.previewContainer}>
            <h3 style={styles.previewTitle}>Aperçu de la Sélection</h3>
            
            <div style={styles.metaBox}>
              <p style={styles.metaText}><strong>Morceaux :</strong> {playlistMeta?.total_songs}</p>
              <p style={styles.metaText}>
                <strong>Durée totale :</strong> {Math.floor((playlistMeta?.total_duration_seconds || 0) / 60)}m { (playlistMeta?.total_duration_seconds || 0) % 60}s 
                <span style={{ color: '#9ca3af' }}> (Cible : {criteria.targetDurationMinutes}m)</span>
              </p>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column' }}>
              <label style={{ ...styles.label, marginBottom: '8px' }}>Nom de la playlist :</label>
              <input 
                type="text" 
                value={playlistName} 
                onChange={(e) => setPlaylistName(e.target.value)} 
                style={styles.input}
                disabled={isSaved}
              />
            </div>

            {/* Liste défilante moderne des pistes */}
            <div style={styles.scrollableListWrapper}>
              <ul style={styles.songList}>
                {generatedSongs.map((song, index) => (
                  <li key={`${song.id}-${index}`} style={styles.songItem}>
                    <div style={{ flex: 1, paddingRight: '10px' }}>
                      <span style={styles.songTitle}>{index + 1}. {song.title}</span>
                      <span style={styles.songArtist}>{song.artist}</span>
                    </div>
                    
                    <div style={styles.actionContainer}>
                      <button onClick={() => playSong(song, generatedSongs)} style={styles.actionBtn} title="Écouter">▶</button>
                      <button onClick={() => moveSong(index, 'up')} disabled={index === 0} style={styles.actionBtn}>🔼</button>
                      <button onClick={() => moveSong(index, 'down')} disabled={index === generatedSongs.length - 1} style={styles.actionBtn}>🔽</button>
                      <button onClick={() => removeSongFromPreview(index)} style={{ ...styles.actionBtn, color: '#ef4444' }} title="Supprimer">❌</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <button 
              onClick={handleSavePlaylist} 
              disabled={isSaved} 
              style={{ ...styles.saveButton, backgroundColor: isSaved ? '#374151' : '#1DB954' }}
            >
              {isSaved ? "Playlist Sauvegardée ! ✓" : "Enregistrer la Playlist dans mon Espace"}
            </button>
          </div>
        )}

        {generatedSongs.length === 0 && playlistMeta && (
          <div style={styles.emptyNotice}>
            ⚠️ Aucun morceau ne correspond exactement à ces critères dans la bibliothèque.
          </div>
        )}
      </div>
    </div>
  );
}

// Styles ajustés pour correspondre à App.jsx et App.css (Fonds sombres, coins arrondis, pas d'écrasement)
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%'
  },
  viewTitle: {
    fontSize: '24px',
    color: '#ffffff',
    marginBottom: '24px',
    textAlign: 'left',
    fontWeight: '600'
  },
  contentLayout: {
    display: 'flex',
    gap: '30px',
    alignItems: 'flex-start',
    flexWrap: 'wrap' // S'adapte si la largeur de l'écran se réduit
  },
  form: {
    backgroundColor: '#12141c',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #1f2430',
    flex: '1 1 400px',
    maxWidth: '500px',
    boxSizing: 'border-box'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '18px'
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between'
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#f3f4f6',
    marginBottom: '8px',
    textAlign: 'left'
  },
  helpText: {
    fontWeight: 'normal',
    color: '#9ca3af',
    fontSize: '11px'
  },
  input: {
    boxSizing: 'border-box',
    width: '100%' // Prend toute la largeur disponible de son conteneur parent sans déborder
  },
  select: {
    width: '100%',
    cursor: 'pointer'
  },
  selectMultiple: {
    width: '100%',
    height: '95px',
    cursor: 'pointer',
    padding: '6px'
  },
  generateButton: {
    backgroundColor: '#1db954',
    color: 'white',
    border: 'none',
    padding: '12px 16px',
    fontSize: '15px',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    fontWeight: '600',
    boxShadow: '0 4px 12px rgba(29, 185, 84, 0.2)',
    marginTop: '10px'
  },
  previewContainer: {
    backgroundColor: '#12141c',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #1db954',
    flex: '1 1 500px',
    maxWidth: '650px',
    boxSizing: 'border-box'
  },
  previewTitle: {
    fontSize: '18px',
    color: '#ffffff',
    margin: '0 0 16px 0',
    textAlign: 'left'
  },
  metaBox: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    border: '1px solid rgba(29, 185, 84, 0.3)',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between'
  },
  metaText: {
    margin: 0,
    fontSize: '14px',
    color: '#f3f4f6'
  },
  scrollableListWrapper: {
    maxHeight: '320px',
    overflowY: 'auto',
    backgroundColor: '#0a0b0d',
    borderRadius: '8px',
    border: '1px solid #1f2430',
    marginBottom: '20px'
  },
  songList: {
    listStyleType: 'none',
    padding: 0,
    margin: 0
  },
  songItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #1f2430',
    textAlign: 'left'
  },
  songTitle: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff'
  },
  songArtist: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  actionContainer: {
    display: 'flex',
    gap: '4px'
  },
  actionBtn: {
    background: '#2a2a2a',
    border: '1px solid #3a3a3a',
    color: '#ffffff',
    borderRadius: '4px',
    padding: '4px 8px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  saveButton: {
    color: 'white',
    border: 'none',
    padding: '14px 20px',
    fontSize: '15px',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    fontWeight: '600',
    transition: 'background-color 0.2s'
  },
  emptyNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    padding: '16px',
    borderRadius: '8px',
    flex: '1 1 400px',
    textAlign: 'left',
    fontSize: '14px'
  }
};