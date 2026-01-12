import React, { useState, useRef, useCallback, useEffect } from 'react';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameCanvas, { GameEngineHandle } from './components/GameCanvas';
import HUD from './components/HUD';
import Radio from './components/Radio';
import AdminPanel from './components/AdminPanel';
import { GameState, GameSettings, Player, DebugState, LeaderboardEntry } from './types';
import { socketService } from './socket';
import { LogOut, Play, Menu as MenuIcon, X } from 'lucide-react';
import { playUiClick } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [settings, setSettings] = useState<GameSettings>({
    playerName: 'Guest',
    playerColor: '#ef4444',
    soundEnabled: true,
    roomId: '',
    isHost: false,
    isOnline: false,
    initialPotatoSpeed: 1.0,
    maxPlayers: 12,
    isPrivate: false
  });

  // Debug State
  const [debugState, setDebugState] = useState<DebugState>({
    isEnabled: false,
    showHitboxes: false,
    showPathfinding: false,
    godMode: false,
    infiniteAbilities: false,
    timeScale: 1.0,
    potatoSpeedModifier: 0,
    enableScreenShake: true
  });

  const [showPauseMenu, setShowPauseMenu] = useState(false);

  // Game Stats State
  const [playerStats, setPlayerStats] = useState<Player | undefined>(undefined);
  const [gameStats, setGameStats] = useState({
    playersAlive: 0,
    totalPlayers: 0,
    gameTime: 0,
    fps: 0,
    ping: 0
  });
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  // Spectator State
  const [spectatingTargetName, setSpectatingTargetName] = useState<string | null>(null);

  const gameEngineRef = useRef<GameEngineHandle>(null);
  const frameCounter = useRef(0);
  
  // Admin Key Trigger Logic (adminmemo)
  const keySequence = useRef<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       const key = e.key.toLowerCase();
       
       // Admin Code
       if (key.length === 1) { 
           keySequence.current = (keySequence.current + key).slice(-9); 
           if (keySequence.current === 'adminmemo') {
               setDebugState(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
               keySequence.current = ''; 
           }
       }

       // Pause Menu Toggle (ESC)
       if (e.key === 'Escape') {
           if (gameState === GameState.PLAYING) {
               setShowPauseMenu(prev => !prev);
           } else if (showPauseMenu) {
               setShowPauseMenu(false);
           }
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, showPauseMenu]);

  // Reset pause menu when game ends
  useEffect(() => {
      if (gameState !== GameState.PLAYING) {
          setShowPauseMenu(false);
      }
  }, [gameState]);

  // Online Game Events Listener
  useEffect(() => {
    if (!settings.isOnline) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    // Ping Check
    socket.on('pong_check', (sentTime) => {
        const latency = Date.now() - sentTime;
        socket.emit('update_ping', latency);
        setGameStats(prev => ({ ...prev, ping: latency }));
    });

    // Game Over Check
    socket.on('game_over', (data: { winnerId: string, players: Player[] }) => {
        handleGameOver(data.winnerId);
        
        // Update leaderboard one last time with final stats
        if (data.players) {
            const sorted = [...data.players].sort((a, b) => b.score - a.score).slice(0, 5).map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                isDead: p.isDead,
                isBot: p.isBot
            }));
            setLeaderboard(sorted);
        }
    });

    // Handle Restart from Game Over screen
    socket.on('game_started', () => {
        setGameState(GameState.PLAYING);
        setWinnerId(null);
    });

    const interval = setInterval(() => {
        socket.emit('ping_check', Date.now());
    }, 2000); 

    return () => {
        clearInterval(interval);
        socket.off('pong_check');
        socket.off('game_over');
        socket.off('game_started');
    };
  }, [settings.isOnline]);

  const handleJoinGame = (newSettings: GameSettings) => {
    setSettings(newSettings);
    // If online, go to waiting room first. If offline (Single player), play immediately.
    if (newSettings.isOnline) {
        setGameState(GameState.WAITING);
    } else {
        setGameState(GameState.PLAYING);
    }
  };

  const handleStartGameOnline = () => {
      setGameState(GameState.PLAYING);
  };

  const handleLeaveRoom = () => {
      socketService.disconnect();
      setGameState(GameState.LOBBY);
      setWinnerId(null);
  };

  const handleGameOver = (winnerId: string) => {
      setGameState(GameState.GAME_OVER);
      setWinnerId(winnerId);
  };

  const handleUpdateStats = useCallback((
    player: Player | undefined, 
    alive: number, 
    total: number, 
    time: number, 
    fps: number, 
    spectatingName: string | null,
    allPlayers: Player[]
  ) => {
    frameCounter.current++;
    if (frameCounter.current % 6 !== 0) return;

    setPlayerStats(player ? { ...player } : undefined);
    setGameStats(prev => ({
      ...prev,
      playersAlive: alive,
      totalPlayers: total,
      gameTime: time,
      fps: fps,
    }));
    setSpectatingTargetName(spectatingName);

    // Only update live leaderboard if game is not over (Game Over updates it with final data)
    if (gameState !== GameState.GAME_OVER) {
        const sorted = [...allPlayers].sort((a, b) => b.score - a.score).slice(0, 5).map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            isDead: p.isDead,
            isBot: p.isBot
        }));
        setLeaderboard(sorted);
    }

  }, [gameState]);

  // Spectator Actions
  const handleSpectateNext = () => { gameEngineRef.current?.spectateNext(); };
  const handleSpectatePrev = () => { gameEngineRef.current?.spectatePrev(); };
  const handleSpectatePotato = () => { gameEngineRef.current?.spectatePotato(); };
  const handleEnterSpectatorMode = () => { gameEngineRef.current?.enterSpectatorMode(); };
  
  const handleReturnToLobby = () => { 
      if(settings.isOnline) {
          handleLeaveRoom();
      } else {
          setGameState(GameState.LOBBY); 
          setWinnerId(null);
      }
      setShowPauseMenu(false);
  };

  const handleRestart = () => {
    // If online host, trigger restart on server
    if (settings.isOnline && settings.isHost) {
        const socket = socketService.getSocket();
        socket?.emit('start_game');
    } else {
        // Local Restart
        gameEngineRef.current?.resetGame();
        setGameState(GameState.PLAYING);
        setWinnerId(null);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900">
      
      {/* Game Canvas always mounted but potentially hidden/paused or active */}
      <GameCanvas 
        ref={gameEngineRef}
        settings={settings}
        gameState={gameState}
        onGameOver={handleGameOver}
        onUpdateStats={handleUpdateStats}
        debugState={debugState}
      />

      {gameState === GameState.LOBBY && (
        <Lobby onJoin={handleJoinGame} />
      )}

      {gameState === GameState.WAITING && (
          <WaitingRoom 
            settings={settings} 
            onStartGame={handleStartGameOnline}
            onLeave={handleLeaveRoom}
          />
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) && (
        <HUD 
          player={playerStats}
          winnerId={winnerId}
          gameState={gameState}
          playersAlive={gameStats.playersAlive}
          totalPlayers={gameStats.totalPlayers}
          gameTime={gameStats.gameTime}
          fps={gameStats.fps}
          ping={gameStats.ping}
          spectatingTargetName={spectatingTargetName}
          onSpectateNext={handleSpectateNext}
          onSpectatePrev={handleSpectatePrev}
          onSpectatePotato={handleSpectatePotato}
          onEnterSpectatorMode={handleEnterSpectatorMode}
          onReturnToLobby={handleReturnToLobby}
          onRestart={handleRestart}
          leaderboard={leaderboard}
        />
      )}

      {/* Pause Menu Overlay */}
      {showPauseMenu && gameState === GameState.PLAYING && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-800 border border-slate-600 p-8 rounded-2xl shadow-2xl max-w-sm w-full relative">
                  <button 
                      onClick={() => { playUiClick(); setShowPauseMenu(false); }}
                      className="absolute top-4 right-4 text-slate-400 hover:text-white"
                  >
                      <X size={24} />
                  </button>
                  
                  <div className="text-center mb-8">
                      <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                          <MenuIcon size={32} className="text-white" />
                      </div>
                      <h2 className="text-2xl font-bold text-white tracking-widest">PAUSED</h2>
                      <p className="text-slate-400 text-sm mt-1">Take a breather</p>
                  </div>

                  <div className="space-y-4">
                      <button 
                          onClick={() => { playUiClick(); setShowPauseMenu(false); }}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                      >
                          <Play size={18} fill="currentColor" /> RESUME
                      </button>

                      <button 
                          onClick={() => { playUiClick(); handleReturnToLobby(); }}
                          className="w-full bg-slate-700 hover:bg-red-600/90 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                          <LogOut size={18} /> LEAVE GAME
                      </button>
                  </div>
              </div>
          </div>
      )}

      <Radio isPlayingGame={gameState === GameState.PLAYING} />
      
      {/* Admin Panel Overlay */}
      <AdminPanel 
        debugState={debugState} 
        onUpdate={setDebugState} 
        onClose={() => setDebugState(prev => ({...prev, isEnabled: false}))} 
      />
    </div>
  );
};

export default App;