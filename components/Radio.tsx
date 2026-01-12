import React, { useState, useRef, useEffect } from 'react';
import { RADIO_STATIONS, playUiClick } from '../constants';
import { Play, Pause, Volume2, VolumeX, Radio as RadioIcon, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

interface RadioProps {
  isPlayingGame: boolean;
}

const Radio: React.FC<RadioProps> = ({ isPlayingGame }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    // Auto-minimize when game starts
    if (isPlayingGame) {
      setIsMinimized(true);
    }
  }, [isPlayingGame]);

  // Handle Volume Changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Handle Play/Pause and Station Changes
  useEffect(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
        setHasError(false);
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                if (error.name !== 'AbortError') {
                    console.error("Playback failed:", error);
                    // Don't auto-disable here, let handleAudioError catch the source failure
                }
            });
        }
    } else {
        audioRef.current.pause();
    }
  }, [isPlaying, currentStationIndex]);

  const togglePlay = () => {
    playUiClick();
    if (!isPlaying) {
        retryCountRef.current = 0; // Reset retry counter on user intent to play
        setHasError(false);
    }
    setIsPlaying(!isPlaying);
  };

  const changeStation = (index: number) => {
    playUiClick();
    retryCountRef.current = 0; // Reset retry counter
    setCurrentStationIndex(index);
    setHasError(false);
    setIsPlaying(true); // Auto-play on station switch
  };

  const handleToggleMinimize = () => {
      playUiClick();
      setIsMinimized(!isMinimized);
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      console.warn(`Radio stream failed for ${RADIO_STATIONS[currentStationIndex].name}:`, e.currentTarget.error?.message);
      
      // If we are currently trying to play
      if (isPlaying) {
          // If we haven't tried every station yet, try the next one
          if (retryCountRef.current < RADIO_STATIONS.length) {
              console.log(`Switching to next station (Attempt ${retryCountRef.current + 1}/${RADIO_STATIONS.length})...`);
              retryCountRef.current++;
              
              const nextIndex = (currentStationIndex + 1) % RADIO_STATIONS.length;
              
              // Small timeout to prevent UI freezing if multiple fail instantly
              setTimeout(() => {
                  setCurrentStationIndex(nextIndex);
              }, 500);
          } else {
              // We've cycled through everything and nothing works
              console.error("All stations failed. Stopping playback.");
              setHasError(true);
              setIsPlaying(false);
              retryCountRef.current = 0;
          }
      } else {
          setHasError(true);
      }
  };

  return (
    // Changed w-12 to w-20 in minimized state to fit the icon and chevron comfortably
    <div className={`fixed bottom-4 left-4 z-50 transition-all duration-300 ${isMinimized ? 'w-20 h-12 overflow-hidden' : 'w-80'}`}>
      <div className="bg-slate-800/90 backdrop-blur-md border border-slate-600 rounded-lg shadow-xl text-white overflow-hidden">
        {/* Header / Minimized View - Padding increased (px-4) for better edge spacing */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 cursor-pointer" onClick={handleToggleMinimize}>
          <div className="flex items-center gap-2">
            <RadioIcon className={`w-5 h-5 ${isPlaying ? 'text-green-400 animate-pulse' : 'text-slate-400'}`} />
            {!isMinimized && <span className="font-bold text-sm">Radio</span>}
          </div>
          <button className="text-slate-400 hover:text-white">
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded Controls */}
        {!isMinimized && (
          <div className="p-4 space-y-4">
            {/* Station Info */}
            <div className="text-center relative">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Now Playing</div>
              <div className="font-medium text-lg text-cyan-300 truncate px-2">{RADIO_STATIONS[currentStationIndex].name}</div>
              {hasError && <div className="text-xs text-red-400 mt-1 flex items-center justify-center gap-1"><AlertCircle size={10}/> Stream unavailable</div>}
            </div>

            {/* Playback Controls */}
            <div className="flex justify-center items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-lg ${hasError ? 'bg-red-900/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 hover:shadow-indigo-500/50'}`}
                disabled={hasError}
              >
                {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={() => { playUiClick(); setIsMuted(!isMuted); }} className="text-slate-400 hover:text-white">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Station List */}
            <div className="mt-2 h-32 overflow-y-auto border-t border-slate-700 pt-2">
              {RADIO_STATIONS.map((station, idx) => (
                <div 
                  key={idx}
                  onClick={() => changeStation(idx)}
                  className={`p-2 rounded cursor-pointer text-sm transition-colors flex justify-between items-center ${currentStationIndex === idx ? 'bg-indigo-900/50 text-indigo-300' : 'hover:bg-slate-700 text-slate-300'}`}
                >
                  <span className="truncate pr-2">{station.name}</span>
                  {currentStationIndex === idx && isPlaying && (
                    <div className="flex gap-0.5 h-3 items-end shrink-0">
                      <div className="w-0.5 bg-indigo-400 h-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-0.5 bg-indigo-400 h-2/3 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-0.5 bg-indigo-400 h-1/2 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <audio 
        ref={audioRef} 
        src={RADIO_STATIONS[currentStationIndex].url} 
        onError={handleAudioError}
        preload="none"
      />
    </div>
  );
};

export default Radio;