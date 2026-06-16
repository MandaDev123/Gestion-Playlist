import React, { useState } from 'react';
import { AudioProvider } from './context/AudioContext';
import Library from './views/Library';
import PlaylistGenerator from './views/PlaylistGenerator';
import MyPlaylists from './views/MyPlaylists'; // Importation de l'espace personnel
import AudioPlayer from './components/AudioPlayer';

function App() {
  const [currentTab, setCurrentTab] = useState('library'); // 'library' | 'generator' | 'my_playlists'

  return (
    <AudioProvider>
      <div style={{ fontFamily: 'sans-serif', paddingBottom: '120px', backgroundColor: '#fdfdfd', minHeight: '100vh' }}>
        <header style={{ background: '#282c34', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>MP3 Smart Playlist Manager</h1>
          <nav>
            <button 
              onClick={() => setCurrentTab('library')} 
              style={{ ...styles.navBtn, backgroundColor: currentTab === 'library' ? '#1DB954' : '#555' }}
            >
              Ma Bibliothèque
            </button>
            <button 
              onClick={() => setCurrentTab('generator')} 
              style={{ ...styles.navBtn, backgroundColor: currentTab === 'generator' ? '#1DB954' : '#555' }}
            >
              Générer une Playlist ✨
            </button>
            <button 
              onClick={() => setCurrentTab('my_playlists')} 
              style={{ ...styles.navBtn, backgroundColor: currentTab === 'my_playlists' ? '#1DB954' : '#555' }}
            >
              Mes Espaces Playlists 📁
            </button>
          </nav>
        </header>
        
        <main style={{ maxWidth: '1200px', margin: '20px auto', padding: '0 20px' }}>
          {currentTab === 'library' && <Library />}
          {currentTab === 'generator' && <PlaylistGenerator />}
          {currentTab === 'my_playlists' && <MyPlaylists />}
        </main>

        <AudioPlayer />
      </div>
    </AudioProvider>
  );
}

const styles = {
  navBtn: {
    color: 'white',
    border: 'none',
    padding: '10px 15px',
    marginLeft: '10px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  }
};

export default App;