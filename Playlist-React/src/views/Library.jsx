import React, { useState, useEffect, useContext } from 'react';
import { AudioContext } from '../context/AudioContext';

export default function Library({ onEditSong }) {
  const [songs, setSongs] = useState([]);
  const [playlist, setPlaylist] = useState([]);
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

  const fetchPlaylist = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/playlists');
      const data = await res.json();
      setPlaylist(data);
    } catch (err) {
      console.error("Erreur chargement bibliothèque", err);
    }
  };

  useEffect(() => {
    fetchSongs();
    fetchPlaylist();
  }, []);

  const handlePlaylistAction = async (e, song) => {
    const actionValue = e.target.value;
    if (!actionValue) return; // Si choix vide

    if (actionValue === "NEW_PLAYLIST") {
      // 1. CRÉATION D'UNE NOUVELLE PLAYLIST
      const playlistName = prompt(`Entrez le nom de la nouvelle playlist pour y ajouter "${song.title}" :`);
      if (!playlistName || playlistName.trim() === "") {
        e.target.value = ""; // Réinitialiser le select
        return;
      }

      try {
        // Enregistrer la nouvelle playlist sur l'API existante (server.js)
        const createRes = await fetch('http://localhost:5000/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: playlistName.trim(),
            user_id: 1, // ID temporaire
            is_generated: false,
            generation_criteria: {},
            song_ids: [song.id] // On injecte directement le morceau actuel à la création
          })
        });

        if (createRes.ok) {
          alert(`Playlist "${playlistName}" créée et "${song.title}" a été ajouté !`);
          fetchPlaylist(); // Recharger les options du menu déroulant
        } else {
          const errData = await createRes.json();
          alert(errData.error || "Erreur lors de la création de la playlist.");
        }
      } catch (err) {
        console.error("Erreur serveur lors de la création :", err);
        alert("Impossible de joindre le serveur.");
      }

    } else {
      // 2. AJOUT À UNE PLAYLIST EXISTANTE
      const playlistId = actionValue;
      const selectedPlaylist = playlist.find(p => p.id === parseInt(playlistId, 10));

      try {
        // Utilise la route POST /api/playlists/:id/songs configurée précédemment
        const addRes = await fetch(`http://localhost:5000/api/playlists/${playlistId}/songs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ song_id: song.id })
        });

        if (addRes.ok) {
          alert(`"${song.title}" a bien été ajouté à la playlist "${selectedPlaylist?.name}".`);
          fetchPlaylist(); // Mettre à jour les données locales au besoin
        } else {
          const errData = await addRes.json();
          alert(errData.error || "Erreur lors de l'ajout du morceau.");
        }
      } catch (err) {
        console.error("Erreur lors de l'ajout à la playlist :", err);
        alert("Erreur de connexion avec le serveur.");
      }
    }

    e.target.value = ""; // Réinitialise l'affichage du menu déroulant après l'action
  };

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
    <div style={{ padding: '10px 0', width: '100%', boxSizing: 'border-box' }}>
      <h2 style={{ marginBottom: '20px' }}>Ma Bibliothèque Musicale</h2>

      {/* Formulaire d'upload */}
      <form onSubmit={handleUpload} style={{ marginBottom: '30px', padding: '15px', border: '1px solid #1f2430', backgroundColor: '#12141c', borderRadius: '8px' }}>
        <h3 style={{ marginTop: 0, fontSize: '16px' }}>Uploader un nouveau morceau (.mp3)</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="file" accept=".mp3" onChange={(e) => setSelectedFile(e.target.files[0])} style={{ color: '#9ca3af' }} />
          <button type="submit" disabled={loading} style={{ background: '#1db954', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
            {loading ? "Analyse en cours..." : "Ajouter à la bibliothèque"}
          </button>
        </div>
      </form>

      {/* CONTENEUR DU TABLEAU ASSURANT LE SANS-DÉBORDEMENT */}
      <div style={{ width: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
        <table
          border="1"
          cellPadding="10"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            borderColor: '#1f2430',
            tableLayout: 'fixed', // FORCE LE TABLEAU À RESTER DANS LES LIMITES
            color: '#f3f4f6'
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#12141c' }}>
              <th style={{ width: '25%', textAlign: 'left' }}>Titre</th>
              <th style={{ width: '20%', textAlign: 'left' }}>Artiste</th>
              <th style={{ width: '15%', textAlign: 'left' }}>Album</th>
              <th style={{ width: '15%', textAlign: 'left' }}>Genre</th>
              <th style={{ width: '8%', textAlign: 'center' }}>Durée</th>
              <th style={{ width: '17%', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr key={song.id} style={{ borderBottom: '1px solid #1f2430' }}>
                {/* styles avec textOverflow pour couper proprement les textes trop longs sans casser la mise en page */}
                <td style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</td>
                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</td>
                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.album}</td>
                <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.genre}</td>
                <td style={{ textAlign: 'center' }}>{Math.floor(song.duration / 60)}:{String(song.duration % 60).padStart(2, '0')}</td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <button onClick={() => playSong(song, songs)} style={{ marginRight: '6px', background: '#4CAF50', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    ▶
                  </button>
                  <button onClick={() => onEditSong(song.id)} style={{ marginRight: '6px', background: '#2196F3', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    ✏️
                  </button>
                  <button onClick={() => handleDelete(song.id)} style={{ background: '#f44336', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    🗑️
                  </button>
                  <select
                    onChange={(e) => handlePlaylistAction(e, song)}
                    defaultValue=""

                  >
                    <option value="" disabled hidden>➕ Playlist</option>
                    <option value="NEW_PLAYLIST" style={{ fontWeight: 'bold', color: '#1db954' }}>
                      ➕ Nouvelle...
                    </option>
                    {playlist.length > 0 && <hr />}
                    {playlist.map((playlist) => (
                      <option key={playlist.id} value={playlist.id}>
                        📁 {playlist.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}