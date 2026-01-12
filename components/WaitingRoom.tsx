import React, { useEffect, useState } from 'react';
import { GameSettings, Player } from '../types';
import { socketService } from '../socket';
import { Play, Copy, Crown, MessageSquare, Send, ArrowLeft, Monitor, Wifi, SignalHigh, SignalMedium, SignalLow, Lock, Unlock } from 'lucide-react';
import { playUiClick } from '../constants';

interface WaitingRoomProps {
    settings: GameSettings;
    onStartGame: () => void;
    onLeave: () => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({ settings, onStartGame, onLeave }) => {
    const [players, setPlayers] = useState<Player[]>([]);
    const [hostId, setHostId] = useState<string>('');
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<{sender: string, text: string, time: string}[]>([]);

    useEffect(() => {
        const socket = socketService.getSocket();
        if (!socket) return;

        // Get initial state if needed, or wait for updates
        socket.on('room_update', (data: { players: any[], hostId: string }) => {
            setPlayers(data.players);
            setHostId(data.hostId);
        });

        socket.on('game_started', () => {
            onStartGame();
        });

        return () => {
            socket.off('room_update');
            socket.off('game_started');
        };
    }, [onStartGame]);

    const handleCopyCode = () => {
        playUiClick();
        navigator.clipboard.writeText(settings.roomId);
    };

    const handleStart = () => {
        playUiClick();
        socketService.getSocket()?.emit('start_game');
    };

    const handleLeave = () => {
        playUiClick();
        onLeave();
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if(!chatInput.trim()) return;
        playUiClick();
        setMessages(prev => [...prev, { sender: settings.playerName, text: chatInput, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) }]);
        setChatInput('');
    };

    const isMeHost = settings.isHost || (socketService.getSocket()?.id === hostId);

    const getPingIcon = (ping: number) => {
        if (ping < 50) return <SignalHigh size={14} className="text-green-500" />;
        if (ping < 120) return <SignalMedium size={14} className="text-yellow-500" />;
        return <SignalLow size={14} className="text-red-500" />;
    };

    return (
        <div className="absolute inset-0 bg-[#1a202c] z-50 flex flex-col font-sans">
            {/* Minimal Haxball-style Header */}
            <div className="h-12 bg-[#2d3748] border-b border-gray-700 flex items-center justify-between px-4 shadow-sm select-none">
                <div className="flex items-center gap-3">
                    <button onClick={handleLeave} className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10">
                        <ArrowLeft size={18} />
                    </button>
                    <div className="text-white font-bold flex items-center gap-2">
                        <span className="text-gray-400">ROOM</span>
                        <span className="text-orange-400 tracking-wider font-mono bg-black/20 px-2 py-0.5 rounded">{settings.roomId}</span>
                    </div>
                    <button onClick={handleCopyCode} className="text-gray-500 hover:text-white p-1" title="Copy Room ID">
                        <Copy size={14} />
                    </button>
                    {settings.isPrivate && (
                        <div className="flex items-center gap-1 text-[10px] text-red-400 bg-red-900/20 px-2 py-0.5 rounded border border-red-900/50">
                            <Lock size={10} /> PRIVATE
                        </div>
                    )}
                </div>
                <div className="text-xs font-bold text-gray-500 bg-black/20 px-3 py-1 rounded-full">
                    {players.length}/{settings.maxPlayers || 12}
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden p-2 gap-2">
                {/* Compact Player List (Table View) */}
                <div className="flex-1 bg-[#232b38] rounded border border-gray-700 flex flex-col shadow-inner">
                    <div className="grid grid-cols-[40px_1fr_60px_60px] bg-[#2d3748] text-xs font-bold text-gray-400 p-2 border-b border-gray-700 uppercase tracking-wider">
                        <div className="text-center">#</div>
                        <div>Nickname</div>
                        <div className="text-center">Ping</div>
                        <div className="text-center">Color</div>
                    </div>
                    
                    <div className="overflow-y-auto flex-1">
                        {players.map((p, idx) => (
                            <div 
                                key={p.id} 
                                className={`grid grid-cols-[40px_1fr_60px_60px] items-center p-2 text-sm border-b border-gray-700/50 hover:bg-white/5 transition-colors ${p.id === socketService.getSocket()?.id ? 'bg-indigo-900/20' : ''}`}
                            >
                                <div className="flex justify-center">
                                    {p.id === hostId ? <Crown size={14} className="text-yellow-500 fill-yellow-500" /> : <span className="text-gray-600 text-xs">{idx + 1}</span>}
                                </div>
                                <div className="font-bold text-gray-200 truncate pr-2">
                                    {p.name}
                                    {p.id === socketService.getSocket()?.id && <span className="ml-2 text-[10px] text-indigo-400 font-normal">(YOU)</span>}
                                </div>
                                <div className="flex items-center justify-center gap-1 font-mono text-xs text-gray-400">
                                    {getPingIcon(p.ping)}
                                    {p.ping}
                                </div>
                                <div className="flex justify-center">
                                    <div 
                                        className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                                        style={{ backgroundColor: p.color }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                         {/* Empty slots filler */}
                         {Array.from({ length: Math.max(0, (settings.maxPlayers || 12) - players.length) }).map((_, i) => (
                            <div key={`empty-${i}`} className="grid grid-cols-[40px_1fr_60px_60px] items-center p-2 text-sm border-b border-gray-800/30 opacity-30">
                                <div className="text-center text-gray-700">-</div>
                                <div className="text-gray-700 italic text-xs">Empty Slot</div>
                                <div></div>
                                <div></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Chat & Settings (More Compact) */}
                <div className="w-80 flex flex-col gap-2">
                    {/* Settings Panel */}
                    <div className="bg-[#232b38] p-3 rounded border border-gray-700">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Room Config</div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs bg-black/20 p-2 rounded">
                                <span className="text-gray-400">Speed Multiplier</span>
                                <span className="text-orange-400 font-mono font-bold">{Math.round(settings.initialPotatoSpeed * 100)}%</span>
                            </div>
                            <div className="flex justify-between text-xs bg-black/20 p-2 rounded">
                                <span className="text-gray-400">Max Players</span>
                                <span className="text-gray-200">{settings.maxPlayers || 12}</span>
                            </div>
                            <div className="flex justify-between text-xs bg-black/20 p-2 rounded">
                                <span className="text-gray-400">Visibility</span>
                                <span className={settings.isPrivate ? "text-red-400" : "text-green-400"}>{settings.isPrivate ? "Private" : "Public"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Chat Panel */}
                    <div className="flex-1 bg-[#232b38] rounded border border-gray-700 flex flex-col overflow-hidden">
                        <div className="p-2 bg-[#2d3748] border-b border-gray-700 flex items-center gap-2 text-xs font-bold text-gray-400">
                            <MessageSquare size={12} /> CHAT
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
                            {messages.map((m, i) => (
                                <div key={i} className="break-words leading-tight">
                                    <span className="text-gray-600 mr-1">[{m.time}]</span>
                                    <span className="font-bold text-indigo-400 mr-1">{m.sender}:</span>
                                    <span className="text-gray-300">{m.text}</span>
                                </div>
                            ))}
                             {messages.length === 0 && <div className="text-gray-600 italic mt-4 text-center">Room created. Waiting for players...</div>}
                        </div>
                        <form onSubmit={handleSendMessage} className="p-2 bg-[#1a202c] border-t border-gray-700 flex gap-1">
                            <input 
                                className="flex-1 bg-[#2d3748] border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                                placeholder="Message..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                            />
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded flex items-center justify-center">
                                <Send size={12} />
                            </button>
                        </form>
                    </div>

                    {/* Start Button */}
                    {isMeHost ? (
                        <button 
                            onClick={handleStart}
                            className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded shadow border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            <Play size={16} fill="currentColor" /> START GAME
                        </button>
                    ) : (
                        <div className="bg-gray-700 text-gray-400 font-bold py-3 rounded text-center text-xs border border-gray-600 cursor-not-allowed">
                            WAITING FOR HOST...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WaitingRoom;