import React from 'react';
import { Player, PowerupType, GameState, LeaderboardEntry } from '../types';
import { ABILITY_COOLDOWNS, playUiClick } from '../constants';
import { Clock, Shield, Wind, User, Zap, Activity, Eye, ChevronLeft, ChevronRight, Flame, Heart, Droplets, Trophy, Skull, Crown } from 'lucide-react';

interface HUDProps {
  player: Player | undefined;
  winnerId: string | null;
  gameState: GameState;
  playersAlive: number;
  totalPlayers: number;
  gameTime: number;
  fps: number;
  ping: number;
  spectatingTargetName: string | null;
  onSpectateNext: () => void;
  onSpectatePrev: () => void;
  onSpectatePotato: () => void;
  onEnterSpectatorMode: () => void;
  onReturnToLobby: () => void;
  onRestart: () => void;
  leaderboard: LeaderboardEntry[];
}

const HUD: React.FC<HUDProps> = ({ 
  player, 
  winnerId,
  gameState, 
  playersAlive, 
  totalPlayers, 
  gameTime,
  fps,
  ping,
  spectatingTargetName,
  onSpectateNext,
  onSpectatePrev,
  onSpectatePotato,
  onEnterSpectatorMode,
  onReturnToLobby,
  onRestart,
  leaderboard
}) => {
  if (gameState === GameState.LOBBY || gameState === GameState.WAITING) return null;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getCooldownProgress = (current: number, max: number) => {
    if (current <= 0) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const handleAction = (action: () => void) => {
      playUiClick();
      action();
  };

  // Circular Ability Button Component
  const AbilityIcon = ({ 
    label, 
    cooldown, 
    maxCooldown, 
    icon: Icon, 
    active,
    title,
    desc,
    silenced
  }: { 
    label: string, 
    cooldown: number, 
    maxCooldown: number, 
    icon: any,
    active: boolean,
    title: string,
    desc: string,
    silenced: boolean
  }) => {
    const progress = getCooldownProgress(cooldown, maxCooldown);
    const isReady = cooldown <= 0;

    return (
      <div className="flex flex-col items-center gap-1 group relative">
        {/* Tooltip */}
        <div className="absolute bottom-full mb-3 hidden group-hover:block w-48 bg-slate-900/95 text-white p-3 rounded-xl border border-slate-600 shadow-xl z-50 text-center animate-fade-in-up">
           <div className="font-bold text-orange-400 mb-1">{title}</div>
           <div className="text-xs text-slate-300">{desc}</div>
        </div>

        <div className="relative w-14 h-14 md:w-16 md:h-16">
          {/* Background */}
          <div className={`absolute inset-0 rounded-full bg-slate-800 border-2 ${active ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)]' : isReady ? 'border-slate-500' : 'border-slate-700'}`}></div>
          
          {/* Icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-6 h-6 md:w-8 md:h-8 ${isReady ? 'text-white' : 'text-slate-500'}`} />
          </div>

          {/* Cooldown Overlay */}
          {!isReady && (
             <div className="absolute inset-0 rounded-full bg-slate-900/80 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{(cooldown / 1000).toFixed(1)}</span>
             </div>
          )}
          
          {/* Silence Overlay */}
          {silenced && (
             <div className="absolute inset-0 rounded-full bg-red-900/60 flex items-center justify-center border-2 border-red-500 z-10">
                <span className="text-xs font-bold text-red-200">X</span>
             </div>
          )}

          {/* SVG Progress Border */}
          {!isReady && (
            <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                cx="50%"
                cy="50%"
                r="48%"
                fill="none"
                stroke="#f97316"
                strokeWidth="3"
                strokeDasharray="100 100" 
                strokeDashoffset={100 - progress} 
                pathLength="100"
              />
            </svg>
          )}

          {/* Key Label */}
          <div className="absolute -bottom-2 -right-2 bg-slate-700 text-xs font-bold px-1.5 py-0.5 rounded border border-slate-500 text-slate-300 z-20">
            {label}
          </div>
        </div>
      </div>
    );
  };

  const isSpectating = !!spectatingTargetName;
  const isSilenced = !!player?.isSilenced;
  
  // Revised Game Over Logic
  const amIWinner = player && (player.id === winnerId);
  const showVictory = gameState === GameState.GAME_OVER && amIWinner;
  const showEliminated = (gameState === GameState.GAME_OVER && !amIWinner) || (gameState === GameState.PLAYING && player?.isDead && !isSpectating);
  
  // Visual HP Calculation: If dead, force show 0 hearts even if sync lag says 1
  const displayedLives = player?.isDead ? 0 : (player?.lives || 0);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden flex flex-col justify-between p-4 md:p-6 z-30">
      
      {/* Top Bar */}
      <div className="flex justify-between items-start pointer-events-auto">
        {/* FPS & Ping */}
        <div className="bg-slate-900/60 backdrop-blur rounded-lg p-2 text-xs font-mono space-y-1 border border-slate-700">
           <div className={`flex items-center gap-2 ${fps > 50 ? 'text-green-400' : fps > 30 ? 'text-yellow-400' : 'text-red-400'}`}>
             <span className="font-bold">{Math.round(fps)}</span> FPS
           </div>
           <div className="flex items-center gap-2 text-slate-400">
             <Activity size={12} />
             <span>{Math.round(ping)} ms</span>
           </div>
        </div>

        {/* Game Info or Spectator Banner */}
        {isSpectating ? (
           <div className="flex flex-col items-center animate-fade-in-down">
             <div className="bg-red-600/90 backdrop-blur-md px-6 py-2 rounded-b-xl shadow-lg border-x border-b border-red-400 flex items-center gap-2">
                <Eye className="w-5 h-5 text-white animate-pulse" />
                <span className="text-white font-bold tracking-wider">SPECTATING</span>
             </div>
             <div className="mt-2 bg-slate-900/80 px-4 py-1 rounded-full text-cyan-300 font-bold border border-slate-700">
                {spectatingTargetName}
             </div>
           </div>
        ) : (
          <div className="flex flex-col items-center">
              <div className="bg-slate-900/80 backdrop-blur-md px-8 py-3 rounded-b-xl border-x border-b border-slate-600 shadow-lg flex items-center gap-8">
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-1">Health</span>
                    <div className="flex gap-1.5 bg-slate-900/50 p-1.5 rounded-lg border border-slate-700/50">
                       {[...Array(3)].map((_, i) => (
                           <Heart 
                             key={i} 
                             size={24} 
                             fill={i < displayedLives ? "#ef4444" : "#1e293b"} 
                             className={`${i < displayedLives ? "text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "text-slate-800"}`} 
                           />
                       ))}
                    </div>
                 </div>
                 <div className="w-px h-10 bg-slate-700"></div>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Alive</span>
                    <span className="text-2xl font-black text-white leading-none mt-1">{playersAlive}<span className="text-slate-500 text-sm">/{totalPlayers}</span></span>
                 </div>
                 <div className="w-px h-10 bg-slate-700"></div>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Time</span>
                    <span className="text-2xl font-black text-yellow-400 font-mono leading-none mt-1">{formatTime(gameTime)}</span>
                 </div>
                 <div className="w-px h-10 bg-slate-700"></div>
                 <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Score</span>
                    <span className="text-2xl font-black text-cyan-400 leading-none mt-1">{Math.floor(player?.score || 0)}</span>
                 </div>
              </div>
          </div>
        )}

        {/* Spectator Leave Button */}
        {isSpectating ? (
          <button 
            onClick={() => handleAction(onReturnToLobby)}
            className="bg-slate-900/80 hover:bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-600 transition-colors pointer-events-auto"
          >
            LEAVE
          </button>
        ) : (
          <div className="w-16"></div> 
        )}
      </div>

      {/* Center: Notifications & Modals */}
      <div className="flex-1 flex items-center justify-center pointer-events-none">
         {showEliminated && (
            <div className="text-center pointer-events-auto bg-slate-900/90 p-8 rounded-3xl border border-red-500/50 shadow-2xl backdrop-blur animate-bounce-in max-w-lg w-full">
               <h2 className="text-6xl font-black text-red-500 mb-2 drop-shadow-lg">ELIMINATED</h2>
               <p className="text-slate-300 text-xl mb-6">The Hot Potato caught you!</p>
               
               {/* Leaderboard Table */}
               <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
                  <div className="text-xs text-slate-400 uppercase font-bold mb-3 flex items-center gap-2 justify-center">
                     <Trophy size={14} className="text-yellow-500" /> Top Survivors
                  </div>
                  <div className="space-y-2">
                     {leaderboard.map((entry, idx) => (
                        <div key={entry.id} className={`flex justify-between items-center text-sm p-2 rounded ${entry.id === player?.id ? 'bg-indigo-900/40 border border-indigo-500/30' : 'bg-slate-900/30'}`}>
                           <div className="flex items-center gap-3">
                              <span className={`font-mono font-bold w-4 ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-500'}`}>#{idx + 1}</span>
                              <span className={`${entry.isDead ? 'text-red-400 line-through' : 'text-white font-bold'}`}>{entry.name}</span>
                              {entry.isDead && <Skull size={12} className="text-red-500" />}
                              {!entry.isDead && entry.id === winnerId && <Crown size={12} className="text-yellow-400" />}
                           </div>
                           <span className="font-mono text-cyan-400">{Math.floor(entry.score)}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="flex gap-4 justify-center">
                 <button 
                   onClick={() => handleAction(onReturnToLobby)}
                   className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
                 >
                   RETURN TO LOBBY
                 </button>
                 <button 
                   onClick={() => handleAction(onEnterSpectatorMode)}
                   className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                 >
                   <Eye size={20} />
                   SPECTATE
                 </button>
               </div>
            </div>
         )}
         
         {showVictory && (
             <div className="text-center pointer-events-auto bg-slate-900/90 p-8 rounded-3xl border border-yellow-500/50 shadow-2xl backdrop-blur animate-bounce-in max-w-lg w-full">
               <h2 className="text-6xl font-black text-yellow-500 mb-2 drop-shadow-lg">VICTORY!</h2>
               <p className="text-slate-300 text-xl mb-6">You are the last one standing!</p>
               
               {/* Leaderboard Table */}
               <div className="bg-slate-800/50 rounded-xl p-4 mb-6 border border-slate-700">
                  <div className="text-xs text-slate-400 uppercase font-bold mb-3 flex items-center gap-2 justify-center">
                     <Trophy size={14} className="text-yellow-500" /> Final Standings
                  </div>
                  <div className="space-y-2">
                     {leaderboard.map((entry, idx) => (
                        <div key={entry.id} className={`flex justify-between items-center text-sm p-2 rounded ${entry.id === player?.id ? 'bg-indigo-900/40 border border-indigo-500/30' : 'bg-slate-900/30'}`}>
                           <div className="flex items-center gap-3">
                              <span className={`font-mono font-bold w-4 ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-orange-400' : 'text-slate-500'}`}>#{idx + 1}</span>
                              <span className={`${entry.isDead ? 'text-red-400' : 'text-white font-bold'}`}>{entry.name}</span>
                              {entry.id === winnerId && <Crown size={12} className="text-yellow-400" />}
                           </div>
                           <span className="font-mono text-cyan-400">{Math.floor(entry.score)}</span>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="flex gap-4 justify-center">
                   <button 
                     onClick={() => handleAction(onReturnToLobby)}
                     className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-transform hover:scale-105"
                   >
                     LOBBY
                   </button>
                   <button 
                     onClick={() => handleAction(onRestart)}
                     className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-transform hover:scale-105"
                   >
                     PLAY AGAIN
                   </button>
               </div>
            </div>
         )}

         {/* Silence Warning */}
         {isSilenced && (
             <div className="bg-red-900/80 text-white px-6 py-2 rounded-lg font-bold border border-red-500 animate-pulse mt-32">
                 SILENCED! Abilities Disabled
             </div>
         )}
      </div>

      {/* Bottom: Abilities OR Spectator Controls */}
      <div className="flex items-end justify-center pb-4 gap-8 pointer-events-auto">
         {isSpectating ? (
           <div className="bg-slate-900/80 backdrop-blur border border-slate-600 rounded-full p-2 flex items-center gap-4 shadow-xl mb-4">
             <button onClick={() => handleAction(onSpectatePrev)} className="p-3 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors">
               <ChevronLeft size={24} />
             </button>
             
             <div className="flex flex-col items-center w-32">
               <span className="text-[10px] text-slate-400 uppercase font-bold">Switch Target</span>
               <div className="flex gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
               </div>
             </div>

             <button 
               onClick={() => handleAction(onSpectatePotato)}
               className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-full font-bold text-sm transition-transform hover:scale-105"
               title="Watch Potato"
             >
               <Flame size={16} />
               POTATO
             </button>

             <button onClick={() => handleAction(onSpectateNext)} className="p-3 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors">
               <ChevronRight size={24} />
             </button>
           </div>
         ) : (
           player && !player.isDead && (
             <div className="flex items-center gap-4 bg-slate-900/50 backdrop-blur-sm p-4 rounded-2xl border border-white/5">
                <AbilityIcon 
                  label="Q" 
                  title="DASH"
                  desc="Burst of speed (2.5x)"
                  cooldown={player.dashCooldown} 
                  maxCooldown={ABILITY_COOLDOWNS.DASH} 
                  icon={Wind}
                  active={player.speed > 300} 
                  silenced={isSilenced}
                />
                <AbilityIcon 
                  label="W" 
                  title="SHIELD"
                  desc="Invulnerable for 3s"
                  cooldown={player.shieldCooldown} 
                  maxCooldown={ABILITY_COOLDOWNS.SHIELD} 
                  icon={Shield}
                  active={player.isShielded}
                  silenced={isSilenced}
                />
                <AbilityIcon 
                  label="E" 
                  title="SMOKE"
                  desc="Invisible to Potato for 5s"
                  cooldown={player.smokeCooldown} 
                  maxCooldown={ABILITY_COOLDOWNS.SMOKE} 
                  icon={Zap} 
                  active={player.isHidden}
                  silenced={isSilenced}
                />
                <AbilityIcon 
                  label="R" 
                  title="SLIME TRAP"
                  desc="Slows enemies & strips buffs"
                  cooldown={player.slimeCooldown} 
                  maxCooldown={ABILITY_COOLDOWNS.SLIME} 
                  icon={Droplets}
                  active={false}
                  silenced={isSilenced}
                />
             </div>
           )
         )}
      </div>
    </div>
  );
};

export default HUD;