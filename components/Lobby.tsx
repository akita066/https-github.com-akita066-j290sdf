import React, { useState, useEffect, useRef } from 'react';
import { GameSettings, ChatMessage } from '../types';
import { Radio, Users, Cpu, Play, Send, MessageSquare, Copy, ArrowRight, Globe, Monitor, RefreshCw, Gauge, Lock, Unlock, Settings2 } from 'lucide-react';
import { socketService } from '../socket';
import { COLORS, playUiClick } from '../constants';

interface LobbyProps {
  onJoin: (settings: GameSettings) => void;
}

const Lobby: React.FC<LobbyProps> = ({ onJoin }) => {
  const [name, setName] = useState('');
  const [gameMode, setGameMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [multiMode, setMultiMode] = useState<'HOST' | 'JOIN'>('HOST');
  
  // Host Settings
  const [potatoSpeed, setPotatoSpeed] = useState(1.0); // 0.5 to 2.0
  const [maxPlayers, setMaxPlayers] = useState(12);
  const [isPrivate, setIsPrivate] = useState(false);
  
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [lobbies, setLobbies] = useState<any[]>([]);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load name from local storage
    const savedName = localStorage.getItem('player_name');
    if (savedName) setName(savedName);

    // Generate a random room ID for hosting (Visual only for single)
    setRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
    
    // Connect socket to get lobbies
    const socket = socketService.connect();
    
    socket.on('lobbies_update', (data) => {
      setLobbies(data);
    });

    socket.on('room_joined', (data: { roomId: string, isHost: boolean, playerId: string, speedModifier: number, maxPlayers: number, isPrivate: boolean }) => {
      // Server confirmed join
      // Save name to local storage
      localStorage.setItem('player_name', name.trim());

      onJoin({
        playerName: name.trim().substring(0, 15),
        roomId: data.roomId,
        isHost: data.isHost,
        playerColor: COLORS[Math.floor(Math.random() * COLORS.length)],
        soundEnabled: true,
        isOnline: true,
        initialPotatoSpeed: data.speedModifier || 1.0,
        maxPlayers: data.maxPlayers || 12,
        isPrivate: data.isPrivate || false
      });
    });

    socket.on('error', (err) => {
        alert(err);
    });

    // System message
    setMessages([
      { id: '1', sender: 'System', text: 'Welcome to Hot Potato .io!', color: '#94a3b8', timestamp: Date.now() }
    ]);

    return () => {
        socket.off('lobbies_update');
        socket.off('room_joined');
        socket.off('error');
    };
  }, [name, onJoin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playUiClick();
    if (name.trim().length === 0) return;

    localStorage.setItem('player_name', name.trim());

    if (gameMode === 'SINGLE') {
       onJoin({
        playerName: name.trim().substring(0, 15),
        roomId: 'LOCAL',
        isHost: true,
        playerColor: '', 
        soundEnabled: true,
        isOnline: false,
        initialPotatoSpeed: potatoSpeed,
        maxPlayers: 12,
        isPrivate: true
      });
    } else {
       // Multiplayer
       const socket = socketService.getSocket();
       const color = COLORS[Math.floor(Math.random() * COLORS.length)];
       
       if (multiMode === 'HOST') {
          socket?.emit('create_room', { name, color, potatoSpeed, maxPlayers, isPrivate });
       } else {
          if (joinRoomId.length < 3) return;
          socket?.emit('join_room', { roomId: joinRoomId, name, color });
       }
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    playUiClick();
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: name || 'Guest',
      text: chatInput.trim(),
      color: '#ffffff',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
    setChatInput('');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const setGameModeWithSound = (mode: 'SINGLE' | 'MULTI') => {
      playUiClick();
      setGameMode(mode);
  };

  const setMultiModeWithSound = (mode: 'HOST' | 'JOIN') => {
      playUiClick();
      setMultiMode(mode);
  };

  const togglePrivateWithSound = () => {
      playUiClick();
      setIsPrivate(!isPrivate);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-40 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900">
        <div className="absolute top-0 left-0 w-full h-full opacity-20">
             <div className="w-full h-full" 
                  style={{
                    backgroundImage: 'linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)',
                    backgroundSize: '50px 50px'
                  }}>
             </div>
        </div>
      </div>

      <div className="relative z-50 flex flex-col md:flex-row gap-6 w-full max-w-6xl p-4 md:p-8 h-full md:h-auto">
        
        {/* Left Side: Game Setup */}
        <div className="flex-1 bg-slate-800/80 backdrop-blur-xl border border-slate-600 rounded-2xl shadow-2xl animate-fade-in-up p-8 flex flex-col max-h-full overflow-y-auto">
          <div className="text-center mb-6">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-600 mb-2 drop-shadow-lg select-none" style={{ fontFamily: 'Impact, sans-serif' }}>
              HOT POTATO.IO
            </h1>
            <p className="text-slate-400 text-sm font-medium">RUN. SURVIVE. DOMINATE.</p>
          </div>

          {/* Top Tabs: Single vs Multi */}
          <div className="flex p-1 bg-slate-900/50 rounded-xl mb-6 shrink-0">
            <button 
              onClick={() => setGameModeWithSound('SINGLE')}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${gameMode === 'SINGLE' ? 'bg-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Monitor size={16} /> SINGLE PLAYER
            </button>
            <button 
              onClick={() => setGameModeWithSound('MULTI')}
              className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${gameMode === 'MULTI' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
            >
              <Globe size={16} /> ONLINE MULTIPLAYER
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col">
            <div>
              <label className="block text-slate-300 text-xs font-bold mb-2 ml-1 uppercase tracking-wider">Nickname</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full bg-slate-900/50 border border-slate-600 text-white text-lg rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent block p-4 placeholder-slate-500 transition-all outline-none"
                maxLength={15}
                autoFocus
              />
            </div>

            {gameMode === 'MULTI' && (
               <div className="flex p-1 bg-slate-900/30 rounded-lg shrink-0">
                  <button type="button" onClick={() => setMultiModeWithSound('HOST')} className={`flex-1 py-2 text-xs font-bold rounded ${multiMode === 'HOST' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>HOST</button>
                  <button type="button" onClick={() => setMultiModeWithSound('JOIN')} className={`flex-1 py-2 text-xs font-bold rounded ${multiMode === 'JOIN' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>JOIN</button>
               </div>
            )}

            {/* Hosting / Single Player Settings */}
            {(gameMode === 'SINGLE' || (gameMode === 'MULTI' && multiMode === 'HOST')) && (
               <div className="bg-slate-900/30 rounded-xl p-4 border border-slate-700/50 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-2">
                     <Settings2 size={14} /> Room Configuration
                  </div>
                  
                  {/* Potato Speed */}
                  <div>
                    <div className="flex justify-between items-end mb-2">
                       <label className="text-slate-300 text-xs font-bold ml-1 flex items-center gap-2">
                         <Gauge size={14} className="text-orange-400"/> Potato Start Speed
                       </label>
                       <span className="text-orange-400 font-bold font-mono">{Math.round(potatoSpeed * 100)}%</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="2.0" step="0.1" value={potatoSpeed}
                      onChange={(e) => setPotatoSpeed(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:rounded-full"
                    />
                  </div>

                  {/* Multiplayer Specifics */}
                  {gameMode === 'MULTI' && multiMode === 'HOST' && (
                    <>
                       {/* Max Players */}
                       <div>
                         <div className="flex justify-between items-end mb-2">
                            <label className="text-slate-300 text-xs font-bold ml-1 flex items-center gap-2">
                              <Users size={14} className="text-cyan-400"/> Max Players
                            </label>
                            <span className="text-cyan-400 font-bold font-mono">{maxPlayers}</span>
                         </div>
                         <input 
                           type="range" min="2" max="12" step="1" value={maxPlayers}
                           onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                           className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full"
                         />
                       </div>

                       {/* Visibility Toggle */}
                       <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors" onClick={togglePrivateWithSound}>
                          <div className="flex items-center gap-3">
                             {isPrivate ? <Lock size={18} className="text-red-400" /> : <Unlock size={18} className="text-green-400" />}
                             <div className="flex flex-col">
                                <span className={`text-sm font-bold ${isPrivate ? 'text-red-400' : 'text-green-400'}`}>
                                    {isPrivate ? 'Private Room' : 'Public Room'}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                    {isPrivate ? 'Hidden from lobby list' : 'Visible to everyone'}
                                </span>
                             </div>
                          </div>
                          <div className={`w-10 h-5 rounded-full relative transition-colors ${isPrivate ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                              <div className={`absolute top-1 w-3 h-3 rounded-full transition-all ${isPrivate ? 'bg-red-500 right-1' : 'bg-green-500 left-1'}`}></div>
                          </div>
                       </div>
                    </>
                  )}
               </div>
            )}

            {/* Join Mode */}
            {gameMode === 'MULTI' && multiMode === 'JOIN' && (
               <div className="space-y-4">
                  <div>
                     <input 
                       type="text" 
                       value={joinRoomId}
                       onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                       placeholder="ENTER ROOM CODE"
                       className="w-full bg-slate-900/50 border border-slate-600 text-white text-lg rounded-xl block p-3 font-mono tracking-widest uppercase text-center focus:border-indigo-500 outline-none"
                     />
                  </div>

                  {/* Active Lobbies List */}
                  <div className="bg-slate-900/40 rounded-xl border border-slate-700 p-3 max-h-48 overflow-y-auto">
                     <div className="flex justify-between items-center mb-2 text-xs text-slate-400 uppercase font-bold sticky top-0 bg-slate-900/95 p-1 z-10">
                        <span>Active Public Lobbies</span>
                        <RefreshCw size={12} />
                     </div>
                     {lobbies.length === 0 ? (
                        <div className="text-slate-500 text-center text-sm py-4 italic">No active public lobbies found</div>
                     ) : (
                        <div className="space-y-2">
                           {lobbies.map(l => (
                              <div key={l.id} className="flex justify-between items-center bg-slate-800 p-2.5 rounded cursor-pointer hover:bg-slate-700 border border-transparent hover:border-indigo-500 transition-all group" onClick={() => { playUiClick(); setMultiMode('JOIN'); setJoinRoomId(l.id); }}>
                                 <span className="font-mono text-orange-400 font-bold group-hover:text-orange-300">{l.id}</span>
                                 <div className="flex items-center gap-3">
                                    <span className="text-xs bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                                        {l.players}/{l.maxPlayers || 12}
                                    </span>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${l.state === 'PLAYING' ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'}`}>
                                        {l.state}
                                    </span>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </div>
            )}

            <button 
              type="submit" 
              disabled={!name.trim() || (gameMode === 'MULTI' && multiMode === 'JOIN' && joinRoomId.length < 3)}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition hover:-translate-y-1 hover:shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 group mt-auto"
            >
              {gameMode === 'SINGLE' ? 'PLAY OFFLINE' : (multiMode === 'HOST' ? 'CREATE LOBBY' : 'JOIN LOBBY')}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>

        {/* Right Side: Lobby Chat */}
        <div className="hidden md:flex flex-col w-80 bg-slate-800/80 backdrop-blur-xl border border-slate-600 rounded-2xl shadow-2xl animate-fade-in-up">
          <div className="p-4 border-b border-slate-700 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-white">Global Chat</h2>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-3 h-[400px]">
            {messages.map((msg) => (
              <div key={msg.id} className="flex flex-col animate-fade-in">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm" style={{ color: msg.sender === 'System' ? '#f59e0b' : '#38bdf8' }}>{msg.sender}</span>
                  <span className="text-[10px] text-slate-500">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="text-slate-300 text-sm break-words bg-slate-900/40 p-2 rounded-lg rounded-tl-none mt-1">
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleChatSubmit} className="p-3 border-t border-slate-700 bg-slate-800/50 rounded-b-2xl">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Say something..."
                className="flex-1 bg-slate-900 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                maxLength={50}
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Lobby;