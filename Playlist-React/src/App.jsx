import { useState, useContext } from 'react';
import { AudioProvider, AudioContext } from './context/AudioContext';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Library from './views/Library';
import PlaylistGenerator from './views/PlaylistGenerator';
import MyPlaylists from './views/MyPlaylists';
import EditSong from './views/EditSong';
import AudioPlayer from './components/AudioPlayer';
import Login from './views/Login';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('library');
  const [editingSongId, setEditingSongId] = useState(null);
  
  // Récupération de l'état global du lecteur audio
  const { currentSong } = useContext(AudioContext);

  // Récupération de l'utilisateur connecté et de la fonction de déconnexion
  const { user, logout } = useContext(AuthContext);

  // Fonction pour ouvrir la page d'édition d'un morceau
  const openEditPage = (id) => {
    setEditingSongId(id);
    setCurrentTab('edit_song');
  };

  // Fonction pour fermer la page d'édition et revenir à la bibliothèque
  const closeEditPage = () => {
    setEditingSongId(null);
    setCurrentTab('library');
  };

  // Calcul dynamique de la hauteur de la zone principale
  const mainHeight = currentSong ? 'calc(100vh - 90px)' : '100vh';

  return (
    <div style={styles.appContainer}>
      
      {/* 1. SIDEBAR À GAUCHE (Taille fixe stricte) */}
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <span style={styles.logoIcon}>🎵</span>
          <h1 style={styles.logoText}>Smart MP3</h1>
        </div>
        
        <nav style={styles.navStack}>
          <button 
            onClick={() => { setCurrentTab('library'); setEditingSongId(null); }} 
            style={{ 
              ...styles.navLink, 
              ...(currentTab === 'library' || currentTab === 'edit_song' ? styles.activeNavLink : {}) 
            }}
          >
            <span style={styles.icon}>📚</span> Ma Bibliothèque
          </button>
          
          <button 
            onClick={() => { setCurrentTab('generator'); setEditingSongId(null); }} 
            style={{ 
              ...styles.navLink, 
              ...(currentTab === 'generator' ? styles.activeNavLink : {}) 
            }}
          >
            <span style={styles.icon}>✨</span> Générer une Playlist
          </button>
          
          <button 
            onClick={() => { setCurrentTab('my_playlists'); setEditingSongId(null); }} 
            style={{ 
              ...styles.navLink, 
              ...(currentTab === 'my_playlists' ? styles.activeNavLink : {}) 
            }}
          >
            <span style={styles.icon}>📁</span> Mes Playlists
          </button>
        </nav>

        <div style={styles.sidebarFooter}>
          {user && (
            <div style={styles.userBlock}>
              <span style={styles.userName}>👤 {user.username}</span>
              <button onClick={logout} style={styles.logoutBtn} title="Se déconnecter">
                🚪 Déconnexion
              </button>
            </div>
          )}
          <p style={styles.footerText}>Version Pro v1.0</p>
        </div>
      </aside>
      
      {/* 2. ZONE DE CONTENU PRINCIPAL À DROITE (Ajustée au pixel près pour éliminer le défilement horizontal) */}
      <div style={{ ...styles.mainWrapper, height: mainHeight }}>
        
        {/* Topbar supérieure */}
        <header style={styles.topbar}>
          <div style={styles.searchPlaceholder}>
            <span>🔍</span> 
            <input type="text" placeholder="Rechercher un titre, un artiste..." style={styles.searchInput} />
          </div>
          <div style={styles.userProfile}>
            <div style={styles.avatar}>U</div>
          </div>
        </header>

        {/* Vues dynamiques */}
        <main style={styles.mainContent}>
          <div style={styles.viewContainer}>
            {currentTab === 'library' && (
              <Library onEditSong={openEditPage} />
            )}
            
            {currentTab === 'edit_song' && editingSongId && (
              <EditSong 
                songId={editingSongId} 
                onCancel={closeEditPage} 
                onSaveSuccess={closeEditPage} 
              />
            )}

            {currentTab === 'generator' && <PlaylistGenerator />}
            {currentTab === 'my_playlists' && <MyPlaylists />}
          </div>
        </main>
      </div>

      {/* LECTEUR AUDIO CONDITIONNEL */}
      {currentSong && (
        <div style={styles.playerWrapper}>
          <AudioPlayer />
        </div>
      )}

    </div>
  );
}

// Composant qui décide d'afficher la page de connexion ou l'application
function AuthGate() {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    // Petite attente pendant la vérification de la session existante (token en localStorage)
    return (
      <div style={styles.loadingScreen}>
        <p style={styles.loadingText}>Chargement...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <AudioProvider>
      <AppContent />
    </AudioProvider>
  );
}

// Composant racine pour envelopper l'application dans l'AuthProvider
function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/* STRUCTURE DES STYLES ULTRA-STRICTE */
const styles = {
  loadingScreen: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0b0d',
    color: '#9ca3af',
    fontFamily: '"Inter", "Segoe UI", sans-serif',
  },
  appContainer: {
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    backgroundColor: '#0a0b0d', 
    color: '#f3f4f6',
    width: '100vw',
    height: '100vh',
    display: 'flex',
    overflow: 'hidden', // Empêche tout défilement global de la page entière
    margin: 0,
    padding: 0,
    boxSizing: 'border-box'
  },
  sidebar: {
    width: '260px',
    minWidth: '260px',
    maxWidth: '260px',
    backgroundColor: '#12141c', 
    borderRight: '1px solid #1f2430',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    justifyContent: 'space-between',
    height: '100vh',
    boxSizing: 'border-box'
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '40px',
    paddingLeft: '8px',
  },
  logoIcon: {
    fontSize: '24px',
    background: 'linear-gradient(135deg, #1db954, #1ed760)',
    padding: '6px',
    borderRadius: '8px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    margin: 0,
    background: 'linear-gradient(to right, #fff, #9ca3af)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  navStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flex: 1,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#9ca3af',
    background: 'transparent',
    border: 'none',
    padding: '12px 16px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    width: '100%',
    boxSizing: 'border-box'
  },
  activeNavLink: {
    color: '#ffffff',
    backgroundColor: '#1db954', 
    boxShadow: '0 4px 12px rgba(29, 185, 84, 0.25)',
  },
  icon: {
    fontSize: '16px',
  },
  sidebarFooter: {
    paddingTop: '20px',
    borderTop: '1px solid #1f2430',
  },
  userBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '12px',
  },
  userName: {
    fontSize: '13px',
    color: '#e5e7eb',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #1f2430',
    color: '#9ca3af',
    padding: '8px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
  },
  footerText: {
    fontSize: '11px',
    color: '#4b5563',
    margin: 0,
    textAlign: 'center',
  },
  mainWrapper: {
    flex: 1,
    // LA LIGNE MAGIQUE : Largeur exacte de l'écran moins la sidebar de 260px
    width: 'calc(100vw - 260px)', 
    maxWidth: 'calc(100vw - 260px)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden', // Sécurité absolue contre le défilement horizontal
    boxSizing: 'border-box',
    transition: 'height 0.1s ease'
  },
  topbar: {
    height: '70px',
    minHeight: '70px',
    width: '100%',
    padding: '0 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1f2430',
    backgroundColor: '#12141c',
    boxSizing: 'border-box'
  },
  searchPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#0a0b0d',
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #1f2430',
    width: '300px',
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '13px',
    outline: 'none',
    width: '100%',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#374151',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
    border: '2px solid #1db954',
  },
  mainContent: {
    flex: 1,
    width: '100%',
    padding: '40px',
    overflowY: 'auto',   // Autorise uniquement le défilement de haut en bas pour voir les musiques
    overflowX: 'hidden',  // Bloque fermement le glissement vers la droite
    backgroundColor: '#0a0b0d',
    boxSizing: 'border-box'
  },
  viewContainer: {
    width: '100%',
    maxWidth: '100%',   // Force le tableau interne à s'adapter à l'espace
    boxSizing: 'border-box',
    overflowX: 'auto'    // Si le tableau est VRAIMENT trop grand, il défilera discrètement tout seul sans casser la page
  },
  playerWrapper: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '90px',
    backgroundColor: '#12141c',
    borderTop: '1px solid #1f2430',
    padding: '0 20px',
    display: 'flex',
    alignItems: 'center',
    zIndex: 100,
    boxSizing: 'border-box'
  }
};

export default App;