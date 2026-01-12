import { PowerupType } from './types';

export const CANVAS_WIDTH = 2000;
export const CANVAS_HEIGHT = 2000;

// Fairness: Everyone sees exactly this much width in game units, regardless of monitor size
export const VIEWPORT_WIDTH = 2000; 

export const PLAYER_RADIUS = 25;
export const POTATO_RADIUS = 20;
export const POWERUP_RADIUS = 20;
export const SLIME_RADIUS = 80; // Size of the puddle

export const BASE_SPEED = 250; // pixels per second
export const POTATO_SPEED = 230; // Slightly slower than player
export const DASH_SPEED_MULTIPLIER = 2.5;

export const ABILITY_COOLDOWNS = {
  DASH: 8000,
  SHIELD: 20000, 
  SMOKE: 12000,
  SLIME: 15000, // Cooldown for R
};

export const ABILITY_DURATIONS = {
  DASH: 300,
  SHIELD: 3000,
  SMOKE: 5000,
  SLIME: 3000, // Puddle lasts 3 seconds
};

// Verified HTTPS streams - prioritized for browser compatibility (CORS/MP3)
export const RADIO_STATIONS = [
  { name: 'Dance FM', url: 'https://edge126.rdsnet.ro/profm/dancefm.mp3' },
  { name: 'Power FM', url: 'https://powerfm.listen.powerapp.com.tr/powerfm/mpeg/icecast.audio' },
  { name: 'Kral Pop', url: 'https://yayin.kralpop.com.tr/kralpop/mpeg/icecast.audio' },
  { name: 'Virgin Radio UK', url: 'https://radio.virginradio.co.uk/stream' },
  { name: 'Capital UK', url: 'https://media-ssl.musicradio.com/Capital' },
  { name: 'Heart UK', url: 'https://media-ssl.musicradio.com/HeartLondon' },
  { name: 'Ibiza Global', url: 'https://listenssl.ibizaglobalradio.com/ibizaglobalradio.mp3' },
  { name: 'Radio 1', url: 'https://icecast2.play.cz/radio1.mp3' },
  { name: 'Süper FM', url: 'https://superfm.listen.powerapp.com.tr/superfm/mpeg/icecast.audio' }
];

export const POWERUP_COLORS: Record<PowerupType, string> = {
  [PowerupType.SPEED]: '#FCD34D', // Yellow
  [PowerupType.COOLDOWN_RESET]: '#60A5FA', // Blue
  [PowerupType.GHOST]: '#A78BFA', // Purple
  [PowerupType.MAGNET]: '#F472B6', // Pink
  [PowerupType.FREEZE]: '#22D3EE', // Cyan
  [PowerupType.DOUBLE_POINTS]: '#4ADE80', // Green
};

export const POWERUP_EMOJIS: Record<PowerupType, string> = {
  [PowerupType.SPEED]: '⚡',
  [PowerupType.COOLDOWN_RESET]: '⏳',
  [PowerupType.GHOST]: '👻',
  [PowerupType.MAGNET]: '🧲',
  [PowerupType.FREEZE]: '❄️',
  [PowerupType.DOUBLE_POINTS]: '💎',
};

export const BUFF_EMOJIS = {
  SHIELD: '🛡️',
  SPEED: '💨',
  GHOST: '👻',
  SMOKE: '🌫️',
  FROZEN: '🧊',
  SILENCED: '😶',
  SLOWED: '🐌'
};

export const BOT_NAMES = [
  'Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Can', 'Cem', 'Deniz', 'Efe', 'Zeynep', 'Burak', 'Selin'
];

export const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'
];

export const playUiClick = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
        console.error("Audio error", e);
    }
};