import React from 'react';
import { DebugState } from '../types';
import { Shield, Zap, Activity, Grid, Play, Pause, FastForward, Flame, Plus, Minus, Vibrate } from 'lucide-react';
import { playUiClick } from '../constants';

interface AdminPanelProps {
  debugState: DebugState;
  onUpdate: (newState: DebugState) => void;
  onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ debugState, onUpdate, onClose }) => {
  if (!debugState.isEnabled) return null;

  const toggle = (key: keyof DebugState) => {
    playUiClick();
    // Cast to DebugState to allow boolean assignment to generic key (assuming caller only toggles booleans)
    onUpdate({ ...debugState, [key]: !debugState[key] } as DebugState);
  };

  const adjustPotatoSpeed = (delta: number) => {
      playUiClick();
      onUpdate({ ...debugState, potatoSpeedModifier: Math.max(0, debugState.potatoSpeedModifier + delta) });
  };

  const adjustTimeScale = (scale: number) => {
      playUiClick();
      onUpdate({...debugState, timeScale: scale});
  };

  return (
    <div className="fixed top-20 right-4 z-[100] bg-slate-900/95 border border-yellow-500/50 rounded-xl shadow-2xl p-4 w-64 animate-fade-in text-white font-mono text-sm">
      <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
        <h2 className="font-bold text-yellow-500 flex items-center gap-2">
           <Activity size={16} /> ADMIN DEBUG
        </h2>
        <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
      </div>

      <div className="space-y-3">
        {/* Game Mechanics */}
        <div className="space-y-2">
           <div className="text-xs text-slate-500 uppercase font-bold">Mechanics</div>
           
           <div className="bg-slate-800 rounded p-2">
               <div className="flex justify-between items-center mb-1">
                   <span className="flex items-center gap-1 text-xs"><Flame size={12} className="text-orange-500"/> Potato Speed Mod</span>
                   <span className="text-orange-400 font-bold">+{Math.round(debugState.potatoSpeedModifier * 100)}%</span>
               </div>
               <div className="flex gap-1">
                   <button onClick={() => adjustPotatoSpeed(-0.1)} className="flex-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"><Minus size={12} className="mx-auto"/></button>
                   <button onClick={() => adjustPotatoSpeed(0.1)} className="flex-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"><Plus size={12} className="mx-auto"/></button>
               </div>
               <div className="text-[9px] text-slate-500 mt-1 leading-tight">
                  Auto-increases by 10% per elimination.
               </div>
           </div>
        </div>

        {/* Visuals */}
        <div className="space-y-2 mt-4">
           <div className="text-xs text-slate-500 uppercase font-bold">Visuals</div>
           <button 
             onClick={() => toggle('enableScreenShake')}
             className={`w-full flex items-center justify-between px-3 py-2 rounded ${debugState.enableScreenShake ? 'bg-indigo-600' : 'bg-slate-800'}`}
           >
             <span className="flex items-center gap-2"><Vibrate size={14}/> Screen Shake</span>
             <span className={debugState.enableScreenShake ? 'text-white' : 'text-slate-500'}>{debugState.enableScreenShake ? 'ON' : 'OFF'}</span>
           </button>

           <button 
             onClick={() => toggle('showHitboxes')}
             className={`w-full flex items-center justify-between px-3 py-2 rounded ${debugState.showHitboxes ? 'bg-indigo-600' : 'bg-slate-800'}`}
           >
             <span className="flex items-center gap-2"><Grid size={14}/> Show Hitboxes</span>
             <span className={debugState.showHitboxes ? 'text-white' : 'text-slate-500'}>{debugState.showHitboxes ? 'ON' : 'OFF'}</span>
           </button>
           
           <button 
             onClick={() => toggle('showPathfinding')}
             className={`w-full flex items-center justify-between px-3 py-2 rounded ${debugState.showPathfinding ? 'bg-indigo-600' : 'bg-slate-800'}`}
           >
             <span className="flex items-center gap-2"><Activity size={14}/> Show AI Path</span>
             <span className={debugState.showPathfinding ? 'text-white' : 'text-slate-500'}>{debugState.showPathfinding ? 'ON' : 'OFF'}</span>
           </button>
        </div>

        {/* Cheats */}
        <div className="space-y-2 mt-4">
           <div className="text-xs text-slate-500 uppercase font-bold">Cheats (Local)</div>
           <button 
             onClick={() => toggle('godMode')}
             className={`w-full flex items-center justify-between px-3 py-2 rounded ${debugState.godMode ? 'bg-green-600' : 'bg-slate-800'}`}
           >
             <span className="flex items-center gap-2"><Shield size={14}/> God Mode</span>
             <span className={debugState.godMode ? 'text-white' : 'text-slate-500'}>{debugState.godMode ? 'ON' : 'OFF'}</span>
           </button>

           <button 
             onClick={() => toggle('infiniteAbilities')}
             className={`w-full flex items-center justify-between px-3 py-2 rounded ${debugState.infiniteAbilities ? 'bg-green-600' : 'bg-slate-800'}`}
           >
             <span className="flex items-center gap-2"><Zap size={14}/> Inf. Abilities</span>
             <span className={debugState.infiniteAbilities ? 'text-white' : 'text-slate-500'}>{debugState.infiniteAbilities ? 'ON' : 'OFF'}</span>
           </button>
        </div>

        {/* Time Scale */}
        <div className="space-y-2 mt-4">
           <div className="text-xs text-slate-500 uppercase font-bold">Game Speed</div>
           <div className="flex bg-slate-800 rounded p-1">
              <button onClick={() => adjustTimeScale(0.5)} className={`flex-1 flex justify-center py-1 rounded ${debugState.timeScale === 0.5 ? 'bg-slate-600' : ''}`}><Pause size={14}/></button>
              <button onClick={() => adjustTimeScale(1.0)} className={`flex-1 flex justify-center py-1 rounded ${debugState.timeScale === 1.0 ? 'bg-slate-600' : ''}`}><Play size={14}/></button>
              <button onClick={() => adjustTimeScale(2.0)} className={`flex-1 flex justify-center py-1 rounded ${debugState.timeScale === 2.0 ? 'bg-slate-600' : ''}`}><FastForward size={14}/></button>
           </div>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-slate-700 text-[10px] text-slate-500 text-center">
         Note: Some cheats only apply to local gameplay or visual debugging in multiplayer.
      </div>
    </div>
  );
};

export default AdminPanel;