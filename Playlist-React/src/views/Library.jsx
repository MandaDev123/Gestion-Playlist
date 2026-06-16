import React, { useState, useEffect, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export default function Library() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const { playSong } = useContext(AudioContext);

  // Pour l'upload
  const [selectedFile, setSelectedFile] = useState(null);

  // Charger la bibliothèque depuis l'API
  const fetchSongs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/songs');
      const data = await res.json();
      setSongs(data);
    } catch (err) {
      console.error("Erreur chargement bibliothèque", err);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // Gestion de l'envoi du fichier MP3
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return alert("Sélectionne un fichier MP3 d'abord !");

    const formData = new FormData();
    formData.append('audio', selectedFile);

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/songs', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        alert("Morceau ajouté et analysé avec succès !");
        setSelectedFile(null);
        e.target.reset();
        fetchSongs(); // Recharger la liste
      } else {
        alert("Erreur lors de l'upload");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Suppression d'un morceau
  const handleDelete = async (id) => {
    if (!window.confirm("Supprimer définitivement ce morceau ?")) return;

    try {
      const res = await fetch(`http://localhost:5000/api/songs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSongs(songs.filter(song => song.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Ma Bibliothèque Musicale</h2>

      {/* Formulaire d'upload */}
      <form onSubmit={handleUpload} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ccc' }}>
        <h3>Uploader un nouveau morceau (.mp3)</h3>
        <input type="file" accept=".mp3" onChange={(e) => setSelectedFile(e.target.files[0])} />
        <button type="submit" disabled={loading}>
          {loading ? "Analyse en cours..." : "Ajouter à la bibliothèque"}
        </button>
      </form>

      {/* Liste des morceaux */}
      <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Titre</th>
            <th>Artiste</th>
            <th>Album</th>
            <th>Genre</th>
            <th>Durée</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {songs.map((song) => (
            <tr key={song.id}>
              <td style={{ fontWeight: 'bold' }}>{song.title}</td>
              <td>{song.artist}</td>
              <td>{song.album}</td>
              <td>{song.genre}</td>
              <td>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</td>
              <td>
                <button onClick={() => playSong(song, songs)} style={{ marginRight: '10px', background: '#4CAF50', color: 'white' }}>
                  ▶ Écouter
                </button>
                <button onClick={() => handleDelete(song.id)} style={{ background: '#f44336', color: 'white' }}>
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}