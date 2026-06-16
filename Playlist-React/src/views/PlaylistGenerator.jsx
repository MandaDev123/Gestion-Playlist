import React, { useState, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export default function PlaylistGenerator() {
  const { playSong } = useContext(AudioContext);

  // États pour les critères du formulaire
  const [criteria, setCriteria] = useState({
    genre: '',
    artist: '',
    album: '',
    language: '',
    year: '',
    targetDurationMinutes: 30 // L'utilisateur saisit en minutes (ex: 30 min)
  });

  // États pour la playlist générée temporairement
  const [generatedSongs, setGeneratedSongs] = useState([]);
  const [playlistMeta, setPlaylistMeta] = useState(null);
  const [playlistName, setPlaylistName] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Gérer les changements des champs de saisie
  const handleChange = (e) => {
    setCriteria({ ...criteria, [e.target.name]: e.target.value });
  };

  // 1. Déclencher la génération intelligente auprès de l'API
  const handleGenerate = async (e) => {
    e.preventDefault();
    setIsSaved(false);

    // Conversion des minutes en secondes pour le backend
    const bodyData = {
      ...criteria,
      target_duration: criteria.targetDurationMinutes * 60
    };
    delete bodyData.targetDurationMinutes; // Nettoyage de la clé inutile pour le back

    try {
      const res = await fetch('http://localhost:5000/api/playlists/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setGeneratedSongs(data.songs);
        setPlaylistMeta(data.meta);
        setPlaylistName(`Ma Playlist Automatique - ${criteria.genre || 'Mix'}`);
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

    // Vérifier les limites du tableau
    if (targetIndex < 0 || targetIndex >= updatedSongs.length) return;

    // Échange de place (Swap)
    const temp = updatedSongs[index];
    updatedSongs[index] = updatedSongs[targetIndex];
    updatedSongs[targetIndex] = temp;

    setGeneratedSongs(updatedSongs);
  };

  // 3. Supprimer un morceau de la playlist temporaire
  const removeSongFromPreview = (index) => {
    const updatedSongs = generatedSongs.filter((_, i) => i !== index);
    setGeneratedSongs(updatedSongs);
    
    // Recalculer la durée totale dans les métadonnées locales
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
      user_id: 1, // Utilisateur temporaire en attendant le système d'authentification
      is_generated: true,
      generation_criteria: criteria,
      song_ids: generatedSongs.map(song => song.id) // Tableau d'ID ordonné
    };

    try {
      const res = await fetch('http://localhost:5000/api/playlists', {
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
    <div style={{ padding: '20px' }}>
      <h2>Générateur Intelligent de Playlist</h2>

      {/* Formulaire des critères */}
      <form onSubmit={handleGenerate} style={styles.form}>
        <div style={styles.formGroup}>
          <label>Genre Musical :</label>
          <input type="text" name="genre" value={criteria.genre} onChange={handleChange} placeholder="Ex: Pop, Rock, Disco-Funk" />
        </div>
        <div style={styles.formGroup}>
          <label>Artiste :</label>
          <input type="text" name="artist" value={criteria.artist} onChange={handleChange} placeholder="Ex: Adele, Dua Lipa" />
        </div>
        <div style={styles.formGroup}>
          <label>Année :</label>
          <input type="number" name="year" value={criteria.year} onChange={handleChange} placeholder="Ex: 2024" />
        </div>
        <div style={styles.formGroup}>
          <label>Langue :</label>
          <input type="text" name="language" value={criteria.language} onChange={handleChange} placeholder="Ex: Français, Anglais" />
        </div>
        <div style={styles.formGroup}>
          <label>Durée Totale Souhaitée (en minutes) :</label>
          <input type="number" name="targetDurationMinutes" value={criteria.targetDurationMinutes} onChange={handleChange} required min="1" />
        </div>
        <button type="submit" style={styles.generateButton}>Générer la Playlist ✨</button>
      </form>

      {/* Zone de prévisualisation et édition de la playlist générée */}
      {generatedSongs.length > 0 && (
        <div style={styles.previewContainer}>
          <h3>Aperçu de la Playlist Générée</h3>
          
          <div style={styles.metaBox}>
            <p><strong>Nombre de morceaux :</strong> {playlistMeta?.total_songs}</p>
            <p><strong>Durée totale obtenue :</strong> {Math.floor((playlistMeta?.total_duration_seconds || 0) / 60)} min { (playlistMeta?.total_duration_seconds || 0) % 60} s (Cible : {criteria.targetDurationMinutes} min)</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label><strong>Nommer la playlist : </strong></label>
            <input 
              type="text" 
              value={playlistName} 
              onChange={(e) => setPlaylistName(e.target.value)} 
              style={styles.nameInput}
              disabled={isSaved}
            />
          </div>

          {/* Liste modifiable des chansons */}
          <ul style={styles.songList}>
            {generatedSongs.map((song, index) => (
              <li key={`${song.id}-${index}`} style={styles.songItem}>
                <div style={{ flex: 1 }}>
                  <strong>{index + 1}. {song.title}</strong> — {song.artist} <small style={{ color: '#666' }}>({Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')})</small>
                </div>
                
                {/* Actions d'édition de l'ordre */}
                <div>
                  <button onClick={() => playSong(song, generatedSongs)} style={styles.actionBtn}>▶ Écouter</button>
                  <button onClick={() => moveSong(index, 'up')} disabled={index === 0} style={styles.actionBtn}>🔼 Up</button>
                  <button onClick={() => moveSong(index, 'down')} disabled={index === generatedSongs.length - 1} style={styles.actionBtn}>🔽 Down</button>
                  <button onClick={() => removeSongFromPreview(index)} style={{ ...styles.actionBtn, color: 'red' }}>❌ Enlever</button>
                </div>
              </li>
            ))}
          </ul>

          {/* Validation finale */}
          <button 
            onClick={handleSavePlaylist} 
            disabled={isSaved} 
            style={{ ...styles.saveButton, backgroundColor: isSaved ? '#ccc' : '#4CAF50' }}
          >
            {isSaved ? "Playlist Sauvegardée ! ✓" : "Accepter & Enregistrer la Playlist"}
          </button>
        </div>
      )}

      {generatedSongs.length === 0 && playlistMeta && (
        <p style={{ color: 'orange', marginTop: '20px' }}>Aucun morceau ne correspond à ces critères dans la bibliothèque.</p>
      )}
    </div>
  );
}

// Quelques styles en ligne pour la présentation
const styles = {
  form: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #ddd',
    maxWidth: '500px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '15px'
  },
  generateButton: {
    backgroundColor: '#1DB954',
    color: 'white',
    border: 'none',
    padding: '10px 15px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    width: '100%'
  },
  previewContainer: {
    marginTop: '30px',
    padding: '20px',
    border: '2px solid #1DB954',
    borderRadius: '8px'
  },
  metaBox: {
    backgroundColor: '#eef9f2',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px'
  },
  nameInput: {
    padding: '8px',
    width: '300px',
    fontSize: '14px'
  },
  songList: {
    listStyleType: 'none',
    padding: 0
  },
  songItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px',
    borderBottom: '1px solid #eee',
    backgroundColor: '#fff'
  },
  actionBtn: {
    marginLeft: '5px',
    cursor: 'pointer',
    padding: '4px 8px'
  },
  saveButton: {
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    fontSize: '16px',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '20px'
  }
};