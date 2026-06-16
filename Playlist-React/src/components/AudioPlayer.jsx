import React, { useContext, useState, useEffect } from 'react';
import { AudioContext } from '../context/AudioContext';

export default function AudioPlayer() {
  const { 
    currentSong, 
    isPlaying, 
    setIsPlaying, 
    nextSong, 
    prevSong, 
    audioRef, 
    playlist 
  } = useContext(AudioContext);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Écouter les mises à jour de temps du lecteur HTML5 natif
  useEffect(() => {
    const audio = audioRef.current;

    const updateProgress = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setDuration(audio.duration);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [audioRef, currentSong]);

  // Si aucun morceau n'est sélectionné, on n'affiche pas le lecteur
  if (!currentSong) return null;

  // Formater le temps (ex: 75 secondes -> "1:15")
  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Gestion du déplacement sur la barre de progression (Seeking)
  const handleProgressChange = (e) => {
    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div style={styles.playerContainer}>
      
      {/* 1. Infos du morceau en cours */}
      <div style={styles.songInfo}>
        <div style={styles.title}>{currentSong.title}</div>
        <div style={styles.artist}>{currentSong.artist || 'Artiste Inconnu'}</div>
      </div>

      {/* 2. Contre-boutons de contrôle et barre de progression */}
      <div style={styles.controlsContainer}>
        <div style={styles.buttons}>
          <button onClick={prevSong} style={styles.controlButton}>⏮</button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)} 
            style={{ ...styles.controlButton, ...styles.playButton }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          
          <button onClick={nextSong} style={styles.controlButton}>⏭</button>
        </div>

        {/* Barre de progression */}
        <div style={styles.progressBarContainer}>
          <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
          <input 
            type="range" 
            min="0" 
            max={duration || 0} 
            value={currentTime} 
            onChange={handleProgressChange} 
            style={styles.slider}
          />
          <span style={styles.timeLabel}>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 3. Infos de contexte (File d'attente courte) */}
      <div style={styles.playlistInfo}>
        <small style={{ color: '#aaa' }}>
          File d'attente : {playlist.length} morceau(x)
        </small>
      </div>

    </div>
  );
}

// Styles basiques en JavaScript pour garder le code autonome et propre
const styles = {
  playerContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '90px',
    backgroundColor: '#181818',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 30px',
    boxShadow: '0 -4px 10px rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  songInfo: {
    flex: 1,
    minWidth: '180px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  artist: {
    fontSize: '12px',
    color: '#b3b3b3',
  },
  controlsContainer: {
    flex: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    maxWidth: '600px',
  },
  buttons: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '8px',
  },
  controlButton: {
    background: 'none',
    border: 'none',
    color: '#b3b3b3',
    fontSize: '20px',
    cursor: 'pointer',
    margin: '0 15px',
    transition: 'color 0.2s',
  },
  playButton: {
    backgroundColor: '#ffffff',
    color: '#000000',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
  },
  progressBarContainer: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  timeLabel: {
    fontSize: '11px',
    color: '#a7a7a7',
    width: '40px',
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    margin: '0 10px',
    cursor: 'pointer',
    accentColor: '#1DB954', // Vert style Spotify
  },
  playlistInfo: {
    flex: 1,
    textAlign: 'right',
  }
};