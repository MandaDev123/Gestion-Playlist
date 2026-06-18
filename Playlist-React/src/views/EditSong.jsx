// src/views/EditSong.jsx
import React, { useState, useEffect } from 'react';

export default function EditSong({ songId, onCancel, onSaveSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    genre: '',
    language: '',
    release_date: '',
    comment: '',
    duration: 0
  });
  const [loading, setLoading] = useState(true);

  // Charger les données actuelles du morceau au montage
  useEffect(() => {
    const fetchSongDetails = async () => {
      try {
        // Optionnel : Si vous n'avez pas de route GET /api/songs/:id dédiée,
        // on récupère tout et on cherche le morceau (ou vous pouvez créer la route dédiée)
        const res = await fetch('http://localhost:5000/api/songs');
        const songs = await res.json();
        const currentSong = songs.find(s => s.id === songId);

        if (currentSong) {
          // Formatage de la date en YYYY-MM-DD pour l'input de type "date"
          let formattedDate = '';
          if (currentSong.release_date) {
            formattedDate = currentSong.release_date.split('T')[0];
          }

          setFormData({
            title: currentSong.title || '',
            artist: currentSong.artist || '',
            album: currentSong.album || '',
            genre: currentSong.genre || '',
            language: currentSong.language || '',
            release_date: formattedDate,
            comment: currentSong.comment || '',
            duration: currentSong.duration || 0
          });
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du morceau", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSongDetails();
  }, [songId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://localhost:5000/api/songs/${songId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        alert("Métadonnées mises à jour avec succès !");
        onSaveSuccess(); // Retour à la bibliothèque
      } else {
        alert("Erreur lors de la modification");
      }
    } catch (err) {
      console.error("Erreur PUT:", err);
    }
  };

  if (loading) return <div>Chargement des données du morceau...</div>;

  return (
    <div style={{ padding: '20px', backgroundColor: '#12141c', borderRadius: '10px', border: '1px solid #1f2430' }}>
      <h2>Modifier les métadonnées</h2>
      
      <form onSubmit={handleSubmit} style={formStyles.form}>
        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Titre :</label>
          <input type="text" name="title" value={formData.title} onChange={handleChange} style={formStyles.input} required />
        </div>

        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Artiste :</label>
          <input type="text" name="artist" value={formData.artist} onChange={handleChange} style={formStyles.input} />
        </div>

        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Album :</label>
          <input type="text" name="album" value={formData.album} onChange={handleChange} style={formStyles.input} />
        </div>

        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Genre :</label>
          <input type="text" name="genre" value={formData.genre} onChange={handleChange} style={formStyles.input} />
        </div>

        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Langue :</label>
          <input type="text" name="language" value={formData.language} onChange={handleChange} style={formStyles.input} />
        </div>

        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Date de sortie :</label>
          <input type="date" name="release_date" value={formData.release_date} onChange={handleChange} style={formStyles.input} />
        </div>

        <div style={formStyles.fieldGroup}>
          <label style={formStyles.label}>Commentaire :</label>
          <textarea name="comment" value={formData.comment} onChange={handleChange} style={{...formStyles.input, height: '80px'}} />
        </div>

        <div style={formStyles.actions}>
          <button type="button" onClick={onCancel} style={formStyles.cancelBtn}>
            Annuler
          </button>
          <button type="submit" style={formStyles.saveBtn}>
            Enregistrer les modifications
          </button>
        </div>
      </form>
    </div>
  );
}

const formStyles = {
  form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '14px', color: '#9ca3af', fontWeight: '600' },
  input: { padding: '10px', borderRadius: '6px', border: '1px solid #1f2430', backgroundColor: '#0a0b0d', color: '#fff', outline: 'none' },
  actions: { display: 'flex', gap: '10px', marginTop: '10px' },
  cancelBtn: { padding: '10px 20px', background: '#374151', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  saveBtn: { padding: '10px 20px', background: '#1db954', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }
};