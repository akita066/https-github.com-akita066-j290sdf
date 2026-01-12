
export type Vector2 = { x: number; y: number };

export enum GameState {
  LOBBY = 'LOBBY',
  WAITING = 'WAITING', // New Haxball-style waiting room
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

export enum PowerupType {
  SPEED = 'SPEED',
  COOLDOWN_RESET = 'COOLDOWN_RESET',
  GHOST = 'GHOST',
  MAGNET = 'MAGNET',
  FREEZE = 'FREEZE',
  DOUBLE_POINTS = 'DOUBLE_POINTS',
}

export interface Player {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  speed: number;
  isDead: boolean;
  score: number;
  lives: number; // New: HP system
  ping: number; // New: Network latency in ms
  
  // Abilities state
  dashCooldown: number;
  shieldCooldown: number;
  smokeCooldown: number;
  slimeCooldown: number; // Renamed from decoy
  
  isShielded: boolean;
  isHidden: boolean; // Smoke
  isGhost: boolean; // Powerup
  magnetActive: boolean; // Powerup
  
  // Debuffs
  isSilenced: boolean; // Cannot use skills
  isSlowed: boolean;   // Visual flag for slow
  
  // Effects
  speedBoostEndTime: number;
}

export interface Potato {
  position: Vector2;
  velocity: Vector2;
  radius: number;
  speed: number;
  targetId: string | null;
  isFrozen: boolean;
  freezeEndTime: number;
  trail: Vector2[];
  currentPath: Vector2[]; // A* Path nodes
  pathUpdateTimer: number;
}

export interface SlimeArea {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  radius: number;
  spawnTime: number;
  duration: number;
}

export interface Powerup {
  id: string;
  type: PowerupType;
  position: Vector2;
  spawnTime: number;
  radius: number;
}

export interface Particle {
  id: string;
  position: Vector2;
  velocity: Vector2;
  color: string;
  life: number; // 0 to 1
  size: number;
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  life: number;     // 1.0 to 0.0
  velocityY: number; // Floating speed
  size: number;
}

export interface GameNotification {
  id: string;
  text: string;
  color: string;
  spawnTime: number;
  duration: number;
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GameSettings {
  playerName: string;
  roomId: string; // New field for hosting/joining
  isHost: boolean;
  soundEnabled: boolean;
  playerColor: string;
  isOnline: boolean; // Flag for online mode
  initialPotatoSpeed: number; // New: Lobby Setting (0.5x to 2.0x)
  maxPlayers: number; // New: Room Capacity
  isPrivate: boolean; // New: Hidden from lobby list
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  color: string;
  timestamp: number;
}

export interface DebugState {
  isEnabled: boolean;
  showHitboxes: boolean;
  showPathfinding: boolean;
  godMode: boolean;
  infiniteAbilities: boolean;
  timeScale: number;
  potatoSpeedModifier: number; // New: Manual speed adjustment
  enableScreenShake: boolean; // New: Toggle screen shake
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  isDead: boolean;
  isBot: boolean;
}