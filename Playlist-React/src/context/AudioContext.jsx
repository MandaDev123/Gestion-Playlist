import React, { createContext, useState, useRef, useEffect } from 'react';

export const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const audioRef = useRef(new Audio());

  // Gestion du changement de source de musique
  useEffect(() => {
    if (currentSong) {
      // Connexion à notre route de streaming du backend
      audioRef.current.src = `http://localhost:5000/api/songs/${currentSong.id}/stream`;
      if (isPlaying) {
        audioRef.current.play().catch(err => console.log("Erreur lecture:", err));
      }
    } else {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  }, [currentSong]);

  // Gestion du Play / Pause
  useEffect(() => {
    if (currentSong) {
      if (isPlaying) {
        audioRef.current.play().catch(err => console.log(err));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Passer automatiquement au morceau suivant à la fin de la chanson
  useEffect(() => {
    const handleEnded = () => {
      nextSong();
    };
    const audio = audioRef.current;
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [currentIndex, playlist]);

  const playSong = (song, customPlaylist = []) => {
    setPlaylist(customPlaylist.length > 0 ? customPlaylist : [song]);
    const index = customPlaylist.findIndex(s => s.id === song.id);
    setCurrentIndex(index !== -1 ? index : 0);
    setCurrentSong(song);
    setIsPlaying(true);
  };

  const nextSong = () => {
    if (playlist.length > 0 && currentIndex < playlist.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setCurrentSong(playlist[nextIdx]);
    }
  };

  const prevSong = () => {
    if (playlist.length > 0 && currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      setCurrentSong(playlist[prevIdx]);
    }
  };

  return (
    <AudioContext.Provider value={{
      currentSong, isPlaying, setIsPlaying, playSong, nextSong, prevSong, audioRef, playlist
    }}>
      {children}
    </AudioContext.Provider>
  );
};