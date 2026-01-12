import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  Player, 
  Potato, 
  Powerup, 
  Vector2, 
  GameState, 
  GameSettings,
  PowerupType,
  Particle,
  Obstacle,
  DebugState,
  SlimeArea,
  FloatingText,
  GameNotification
} from '../types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  PLAYER_RADIUS, 
  POTATO_RADIUS, 
  BASE_SPEED, 
  POTATO_SPEED,
  ABILITY_COOLDOWNS,
  ABILITY_DURATIONS,
  BOT_NAMES,
  COLORS,
  POWERUP_RADIUS,
  POWERUP_COLORS,
  POWERUP_EMOJIS,
  BUFF_EMOJIS,
  VIEWPORT_WIDTH,
  SLIME_RADIUS
} from '../constants';
import { socketService } from '../socket';

export interface GameEngineHandle {
  spectateNext: () => void;
  spectatePrev: () => void;
  spectatePotato: () => void;
  enterSpectatorMode: () => void;
  resetGame: () => void;
}

interface GameCanvasProps {
  settings: GameSettings;
  gameState: GameState;
  onGameOver: (winnerId: string) => void;
  onUpdateStats: (player: Player | undefined, alive: number, total: number, time: number, fps: number, spectatingName: string | null, allPlayers: Player[]) => void;
  debugState: DebugState;
}

// A* Node structure (Local Only)
interface Node {
  x: number; y: number; f: number; g: number; h: number; parent: Node | null;
}
const GRID_SIZE = 50; 
const MIN_OBSTACLE_GAP = 80; // Minimum distance between walls to prevent getting stuck

// Linear Interpolation Helper
const lerp = (start: number, end: number, t: number) => {
    return start * (1 - t) + end * t;
};

// Collision Helper: Is Position Valid? (Client Side)
const isPositionValid = (x: number, y: number, radius: number, obstacles: Obstacle[]) => {
    // 1. Map Boundaries
    if (x < radius || x > CANVAS_WIDTH - radius || y < radius || y > CANVAS_HEIGHT - radius) {
        return false;
    }

    // 2. Obstacles (Hard Walls)
    for (const obs of obstacles) {
        const testX = Math.max(obs.x, Math.min(x, obs.x + obs.width));
        const testY = Math.max(obs.y, Math.min(y, obs.y + obs.height));
        const distX = x - testX;
        const distY = y - testY;
        
        // If distance is less than radius, we are inside/touching the wall -> Invalid
        if ((distX*distX + distY*distY) < (radius*radius)) {
            return false;
        }
    }
    return true;
};

const GameCanvas = forwardRef<GameEngineHandle, GameCanvasProps>(({ 
  settings, 
  gameState, 
  onGameOver,
  onUpdateStats,
  debugState
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game State Refs
  const playersRef = useRef<Player[]>([]);
  const potatoesRef = useRef<Potato[]>([]);
  const powerupsRef = useRef<Powerup[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const slimeAreasRef = useRef<SlimeArea[]>([]);
  
  // Server State Ref (Target for interpolation)
  const serverStateRef = useRef<{players: Player[], potatoes: Potato[]} | null>(null);

  // Local Visuals (Trails)
  const localPotatoTrailsRef = useRef<Vector2[]>([]);

  // Game Juice Refs
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const notificationsRef = useRef<GameNotification[]>([]);
  const screenShakeRef = useRef<number>(0);
  
  // Game Mechanic Refs
  const potatoSpeedMultiplierRef = useRef<number>(1.0); 

  // Camera & Inputs
  const mouseRef = useRef<Vector2>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const cameraRef = useRef<Vector2>({ x: 0, y: 0 });
  const scaleRef = useRef<number>(1.0);
  const spectatingIdRef = useRef<string | null>(null);
  
  const timeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(0);
  const framesRef = useRef<number>(0);
  const fpsRef = useRef<number>(60);
  const animationFrameRef = useRef<number>(0);
  const lastInputTimeRef = useRef<number>(0);

  // Expose methods
  useImperativeHandle(ref, () => ({
    spectateNext: () => cycleSpectator(1),
    spectatePrev: () => cycleSpectator(-1),
    spectatePotato: () => { spectatingIdRef.current = 'POTATO'; },
    enterSpectatorMode: () => {
      const alive = playersRef.current.filter(p => !p.isDead && p.id !== (settings.isOnline ? socketService.getSocket()?.id : 'user'));
      if (alive.length > 0) spectatingIdRef.current = alive[0].id;
      else spectatingIdRef.current = 'POTATO';
    },
    resetGame: () => {
      if (!settings.isOnline) {
         initGameLocal();
      }
      lastFpsTimeRef.current = Date.now();
      framesRef.current = 0;
      localPotatoTrailsRef.current = [];
    }
  }));

  const cycleSpectator = (dir: number) => {
    const alivePlayers = playersRef.current.filter(p => !p.isDead);
    const targets = [...alivePlayers.map(p => p.id), 'POTATO'];
    let currentIndex = targets.indexOf(spectatingIdRef.current || '');
    if (currentIndex === -1) currentIndex = 0;
    let nextIndex = (currentIndex + dir + targets.length) % targets.length;
    spectatingIdRef.current = targets[nextIndex];
  };

  const addFloatingText = (pos: Vector2, text: string, color: string, size: number = 20) => {
      floatingTextsRef.current.push({
          id: Math.random().toString(),
          text,
          x: pos.x,
          y: pos.y - 30, // Start slightly above
          color,
          life: 1.0,
          velocityY: -50, // Move up
          size
      });
  };

  const addNotification = (text: string, color: string = '#ffffff') => {
      // Limit to 3 notifications stack
      if (notificationsRef.current.length > 2) notificationsRef.current.shift();
      notificationsRef.current.push({
          id: Math.random().toString(),
          text,
          color,
          spawnTime: Date.now(),
          duration: 3000
      });
  };

  const triggerScreenShake = (amount: number) => {
      screenShakeRef.current = amount;
  };

  useEffect(() => {
    // Handle Window Resize for Fairness Scaling
    const handleResize = () => {
        if(canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
            // Calculate scale to ensure VIEWPORT_WIDTH is visible regardless of screen size
            scaleRef.current = window.innerWidth / VIEWPORT_WIDTH;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    if (gameState === GameState.PLAYING) {
      if (settings.isOnline) {
         initGameOnline();
      } else {
         initGameLocal();
      }
      lastFpsTimeRef.current = Date.now();
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameRef.current);
        if(settings.isOnline) {
             const socket = socketService.getSocket();
             socket?.off('game_state');
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, settings.isOnline]);

  const initGameOnline = () => {
     // Setup socket listeners for state updates
     const socket = socketService.getSocket();
     if(socket) {
         socket.on('game_state', (state: any) => {
            // Store target state for interpolation
            serverStateRef.current = {
                players: state.players,
                potatoes: state.potatoes
            };

            // Non-interpolated data can be set directly
            obstaclesRef.current = state.obstacles;
            powerupsRef.current = state.powerups;
            slimeAreasRef.current = state.slimeAreas || [];
            
            // Initial load: Set positions directly to avoid flying from 0,0
            if (playersRef.current.length === 0) {
                playersRef.current = state.players;
                potatoesRef.current = state.potatoes;
            }
         });
     }
  };

  const initGameLocal = () => {
    // 1. Generate Obstacles with Safe Gaps
    obstaclesRef.current = [];
    const numObstacles = 15;
    let attempts = 0;
    
    while (obstaclesRef.current.length < numObstacles && attempts < 1000) {
        attempts++;
        const w = Math.random() * 200 + 100;
        const h = Math.random() * 200 + 100;
        const ox = Math.random() * (CANVAS_WIDTH - w);
        const oy = Math.random() * (CANVAS_HEIGHT - h);
        
        // Keep center clear
        if (Math.abs(ox - CANVAS_WIDTH/2) < 300 && Math.abs(oy - CANVAS_HEIGHT/2) < 300) continue;

        // Check distance against existing obstacles (prevent stuck players)
        let tooClose = false;
        for (const obs of obstaclesRef.current) {
            // Check if ranges overlap with padding (MIN_GAP)
            const overlapX = (ox < obs.x + obs.width + MIN_OBSTACLE_GAP) && (ox + w > obs.x - MIN_OBSTACLE_GAP);
            const overlapY = (oy < obs.y + obs.height + MIN_OBSTACLE_GAP) && (oy + h > obs.y - MIN_OBSTACLE_GAP);
            
            if (overlapX && overlapY) {
                tooClose = true;
                break;
            }
        }

        if (!tooClose) {
            obstaclesRef.current.push({ id: `obs-${obstaclesRef.current.length}`, x: ox, y: oy, width: w, height: h });
        }
    }

    const shuffledColors = [...COLORS].sort(() => 0.5 - Math.random());
    const userColor = shuffledColors.pop() || '#ffffff';

    const userPlayer: Player = createPlayer('user', settings.playerName, userColor, false);
    const bots: Player[] = Array.from({ length: 11 }).map((_, i) => 
       createPlayer(`bot-${i}`, BOT_NAMES[i % BOT_NAMES.length], shuffledColors[i % shuffledColors.length] || COLORS[i % COLORS.length], true)
    );

    playersRef.current = [userPlayer, ...bots];
    
    // Use initialPotatoSpeed from settings
    const startSpeed = POTATO_SPEED * (settings.initialPotatoSpeed || 1.0);

    potatoesRef.current = [{
      position: { x: 100, y: 100 }, 
      velocity: { x: 0, y: 0 },
      radius: POTATO_RADIUS,
      speed: startSpeed,
      targetId: null,
      isFrozen: false,
      freezeEndTime: 0,
      trail: [],
      currentPath: [],
      pathUpdateTimer: 0
    }];
    powerupsRef.current = [];
    particlesRef.current = [];
    slimeAreasRef.current = [];
    floatingTextsRef.current = [];
    notificationsRef.current = [];
    spectatingIdRef.current = null;
    potatoSpeedMultiplierRef.current = 1.0;
    localPotatoTrailsRef.current = [];
    startTimeRef.current = Date.now();
  };

  const createPlayer = (id: string, name: string, color: string, isBot: boolean): Player => {
     let pos = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
     if (isBot) {
         pos = findSafeSpawn();
     }
     return {
        id, name, color, isBot, position: pos, velocity: { x: 0, y: 0 },
        radius: PLAYER_RADIUS, speed: BASE_SPEED, isDead: false, score: 0, lives: 3, ping: 0,
        dashCooldown: 0, shieldCooldown: 0, smokeCooldown: 0, slimeCooldown: 0,
        isShielded: false, isHidden: false, isGhost: false, magnetActive: false, 
        isSilenced: false, isSlowed: false, speedBoostEndTime: 0
     };
  };

  const findSafeSpawn = (): Vector2 => {
    let safe = false;
    let px = CANVAS_WIDTH / 2;
    let py = CANVAS_HEIGHT / 2;
    
    let attempts = 0;
    while (!safe && attempts < 100) {
        attempts++;
        px = Math.random() * (CANVAS_WIDTH - 200) + 100;
        py = Math.random() * (CANVAS_HEIGHT - 200) + 100;
        safe = true;
        
        // Avoid Obstacles
        for (const obs of obstaclesRef.current) {
            if (px > obs.x - PLAYER_RADIUS && px < obs.x + obs.width + PLAYER_RADIUS &&
                py > obs.y - PLAYER_RADIUS && py < obs.y + obs.height + PLAYER_RADIUS) {
                safe = false; break;
            }
        }
        // Avoid Potatoes
        if (safe) {
             for (const pot of potatoesRef.current) {
                 if (Math.hypot(px - pot.position.x, py - pot.position.y) < 300) {
                     safe = false; break;
                 }
             }
        }
    }
    return { x: px, y: py };
  };

  // --- Game Loop ---
  const gameLoop = () => {
    if (gameState !== GameState.PLAYING) return;
    
    const now = Date.now();
    const dt = (1 / 60) * debugState.timeScale; // Apply Time Scale 
    timeRef.current = now - startTimeRef.current;

    // --- CLIENT SIDE PREDICTION LOGIC ---
    // 1. Always run physics for local player (My Player)
    // 2. Only run full physics (bots, collisions) if Offline
    
    if (settings.isOnline) {
        // Run physics ONLY for local player to predict movement immediately
        updatePhysics(dt, now); 
        
        // Throttled Input Sending (Save Bandwidth, 20 times per second)
        if (now - lastInputTimeRef.current > 50) {
            const socket = socketService.getSocket();
            if(socket) {
                socket.emit('input', {
                    x: mouseRef.current.x,
                    y: mouseRef.current.y
                });
            }
            lastInputTimeRef.current = now;
        }

        // Interpolate OTHERS (and Potato)
        if (serverStateRef.current) {
            applyOnlineInterpolation(0.2); 
        }
        
        updateLocalTrails();
    } else {
        // Offline: Full Simulation
        updatePhysics(dt, now);
        updateAI(dt, now);
        updatePotatoes(dt, now);
        updatePowerups(now);
        checkCollisions(now);
    }

    // Visuals always run
    updateParticles(dt);
    updateFloatingText(dt);
    
    framesRef.current++;
    if (now - lastFpsTimeRef.current >= 1000) {
      fpsRef.current = framesRef.current;
      framesRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    render();
    
    // HUD Stats
    const myId = settings.isOnline ? socketService.getSocket()?.id : 'user';
    const user = playersRef.current.find(p => p.id === myId);
    const aliveCount = playersRef.current.filter(p => !p.isDead).length;
    let spectatingName = null;
    if (spectatingIdRef.current) {
        if (spectatingIdRef.current === 'POTATO') spectatingName = 'Hot Potato';
        else spectatingName = playersRef.current.find(p => p.id === spectatingIdRef.current)?.name || 'Unknown';
    }

    onUpdateStats(user, aliveCount, playersRef.current.length, timeRef.current, fpsRef.current, spectatingName, playersRef.current);
    animationFrameRef.current = requestAnimationFrame(gameLoop);
  };
  
  // --- Online Specifics ---
  const applyOnlineInterpolation = (factor: number) => {
      if (!serverStateRef.current) return;
      
      const myId = socketService.getSocket()?.id;
      
      // Interpolate Players
      const targetPlayers = serverStateRef.current.players;
      
      // Update existing or add new
      const nextPlayers = targetPlayers.map(targetP => {
          const currentP = playersRef.current.find(p => p.id === targetP.id);
          
          if (currentP) {
              // CLIENT SIDE PREDICTION CHECK:
              // If this is ME, don't overwrite position with server unless it's a huge desync (Reconciliation)
              // This makes movement instant and buttery smooth.
              if (targetP.id === myId) {
                  const dist = Math.hypot(targetP.position.x - currentP.position.x, targetP.position.y - currentP.position.y);
                  
                  // If server says we are > 50px away, we likely hit a wall or lag spiked. Snap to server.
                  if (dist > 50) {
                      return targetP; 
                  } else {
                      // Trust local physics, but update stats (score, cooldowns, dead status) from server
                      return {
                          ...targetP,
                          position: currentP.position // Keep local position
                      };
                  }
              }

              // For OTHER players, Interpolate smoothly
              const lx = lerp(currentP.position.x, targetP.position.x, factor);
              const ly = lerp(currentP.position.y, targetP.position.y, factor);
              
              return {
                  ...targetP,
                  position: { x: lx, y: ly }
              };
          } else {
              return targetP; // New player
          }
      });
      playersRef.current = nextPlayers;

      // Interpolate Potato
      const targetPotatoes = serverStateRef.current.potatoes;
      potatoesRef.current = targetPotatoes.map((targetP, index) => {
          const currentP = potatoesRef.current[index];
          if (currentP) {
              return {
                  ...targetP,
                  position: {
                      x: lerp(currentP.position.x, targetP.position.x, factor),
                      y: lerp(currentP.position.y, targetP.position.y, factor)
                  },
                  trail: currentP.trail // Preserve local trails if needed, though we use separate ref now
              };
          }
          return targetP;
      });
  };

  const updateLocalTrails = () => {
      if (potatoesRef.current.length > 0) {
          if (framesRef.current % 5 === 0) { // Every 5 frames
              const p = potatoesRef.current[0];
              localPotatoTrailsRef.current.push({ ...p.position });
              if (localPotatoTrailsRef.current.length > 20) localPotatoTrailsRef.current.shift();
          }
      } else {
          localPotatoTrailsRef.current = [];
      }
  };

  // --- LOCAL PHYSICS ---
  const updatePhysics = (dt: number, now: number) => {
    // 1. Manage Slime Areas (Local)
    slimeAreasRef.current = slimeAreasRef.current.filter(s => now < s.spawnTime + s.duration);

    // Check Single Player Victory Condition (Last Man Standing)
    const alivePlayers = playersRef.current.filter(p => !p.isDead);
    if (!settings.isOnline && alivePlayers.length === 1 && alivePlayers[0].id === 'user') {
        onGameOver('user');
        return;
    }
    
    const myId = settings.isOnline ? socketService.getSocket()?.id : 'user';

    playersRef.current.forEach(p => {
      // ONLINE OPTIMIZATION:
      // Only simulate physics for MY player. Trust interpolation for others.
      if (settings.isOnline && p.id !== myId) return;

      if (p.isDead) return;
      
      // Infinite Abilities Cheat
      if (debugState.infiniteAbilities && p.id === 'user') {
          p.dashCooldown = 0;
          p.shieldCooldown = 0;
          p.smokeCooldown = 0;
          p.slimeCooldown = 0;
      } else if (!settings.isOnline) {
         // Only decrement cooldowns locally in offline mode. 
         // In online mode, server handles cooldown logic, we just predict movement.
        p.dashCooldown = Math.max(0, p.dashCooldown - dt * 1000);
        p.shieldCooldown = Math.max(0, p.shieldCooldown - dt * 1000);
        p.smokeCooldown = Math.max(0, p.smokeCooldown - dt * 1000);
        p.slimeCooldown = Math.max(0, p.slimeCooldown - dt * 1000);
      }

      let moveSpeed = p.speed;
      if (now > p.speedBoostEndTime) moveSpeed = BASE_SPEED;
      p.isShielded = (p.shieldCooldown > ABILITY_COOLDOWNS.SHIELD - ABILITY_DURATIONS.SHIELD);
      p.isHidden = (p.smokeCooldown > ABILITY_COOLDOWNS.SMOKE - ABILITY_DURATIONS.SMOKE);
      
      // Slime Check
      p.isSilenced = false;
      p.isSlowed = false;
      for (const slime of slimeAreasRef.current) {
          const dist = Math.hypot(p.position.x - slime.x, p.position.y - slime.y);
          if (dist < slime.radius && p.id !== slime.ownerId) {
              moveSpeed *= 0.75;
              p.isSlowed = true;
              p.isSilenced = true;
              p.speedBoostEndTime = 0;
              p.isShielded = false; 
              p.shieldCooldown = Math.max(p.shieldCooldown, 1000);
              p.isHidden = false; 
              p.smokeCooldown = Math.max(p.smokeCooldown, 1000);
              p.isGhost = false;
          }
      }
      p.speed = moveSpeed;

      if (!settings.isOnline) {
          p.score += dt * 10; 
          // Spawn extra potato every 500 score (more aggressive)
          const expectedPotatoes = 1 + Math.floor(p.score / 500);
          if (potatoesRef.current.length < expectedPotatoes && potatoesRef.current.length < 10) {
              spawnExtraPotato();
          }
      }

      let targetX = p.position.x;
      let targetY = p.position.y;
      
      // My Player / User Logic
      if (p.id === myId || p.id === 'user') {
        targetX = mouseRef.current.x;
        targetY = mouseRef.current.y;
        movePlayerToward(p, targetX, targetY, dt);
      }
    });

    // 2. Resolve Player-vs-Player Collisions (Local)
    // Only run full PvP collision resolution offline. 
    // Online, server handles pushing. We just handle movement prediction.
    if (!settings.isOnline) {
        for (let i = 0; i < playersRef.current.length; i++) {
            for (let j = i + 1; j < playersRef.current.length; j++) {
                const p1 = playersRef.current[i];
                const p2 = playersRef.current[j];

                if (p1.isDead || p2.isDead || p1.isGhost || p2.isGhost) continue;

                const dx = p2.position.x - p1.position.x;
                const dy = p2.position.y - p1.position.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minDist = p1.radius + p2.radius;

                if (dist < minDist && dist > 0) {
                    const overlap = (minDist - dist) / 2;
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Proposed
                    const p1NextX = p1.position.x - nx * overlap;
                    const p1NextY = p1.position.y - ny * overlap;
                    const p2NextX = p2.position.x + nx * overlap;
                    const p2NextY = p2.position.y + ny * overlap;

                    // Apply Hard Wall Constraints
                    if (isPositionValid(p1NextX, p1.position.y, p1.radius, obstaclesRef.current)) p1.position.x = p1NextX;
                    if (isPositionValid(p1.position.x, p1NextY, p1.radius, obstaclesRef.current)) p1.position.y = p1NextY;

                    if (isPositionValid(p2NextX, p2.position.y, p2.radius, obstaclesRef.current)) p2.position.x = p2NextX;
                    if (isPositionValid(p2.position.x, p2NextY, p2.radius, obstaclesRef.current)) p2.position.y = p2NextY;
                }
            }
        }
    }
  };

  const spawnExtraPotato = () => {
     potatoesRef.current.push({
        position: { x: 50, y: 50 }, velocity: { x: 0, y: 0 }, radius: POTATO_RADIUS, speed: POTATO_SPEED * 1.1,
        targetId: null, isFrozen: false, freezeEndTime: 0, trail: [], currentPath: [], pathUpdateTimer: 0
     });
     spawnParticles({x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2}, 50, '#ff4500');
     triggerScreenShake(10);
     addNotification("Another Potato Spawned!", "#ff4500");
  };

  const movePlayerToward = (p: Player, tx: number, ty: number, dt: number) => {
      const dx = tx - p.position.x;
      const dy = ty - p.position.y;
      
      // For Human Player ('user'): Fix Jitter by checking distance
      if (p.id === 'user' || (settings.isOnline && p.id === socketService.getSocket()?.id)) {
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          // Deadzone to prevent jitter when mouse is very close
          if (dist < 5) return;

          const moveStep = p.speed * dt;
          let vx = 0;
          let vy = 0;

          if (dist < moveStep) {
              vx = dx;
              vy = dy;
          } else {
              const angle = Math.atan2(dy, dx);
              vx = Math.cos(angle) * moveStep;
              vy = Math.sin(angle) * moveStep;
          }
          applyMovement(p, vx, vy);
          return;
      }

      // For Bots: Use Standard Position Targeting (with deadzone)
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 1) {
        const moveSpeed = p.speed * dt;
        const vx = (dx / dist) * moveSpeed;
        const vy = (dy / dist) * moveSpeed;
        applyMovement(p, vx, vy);
      }
  };

  const applyMovement = (p: Player, vx: number, vy: number) => {
      // Try X
      const nextX = p.position.x + vx;
      if (isPositionValid(nextX, p.position.y, p.radius, obstaclesRef.current)) {
          p.position.x = nextX;
      }

      // Try Y
      const nextY = p.position.y + vy;
      if (isPositionValid(p.position.x, nextY, p.radius, obstaclesRef.current)) {
          p.position.y = nextY;
      }
  };

  const circleRectCollision = (cx: number, cy: number, r: number, rect: Obstacle) => {
    const testX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const testY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const distX = cx - testX;
    const distY = cy - testY;
    return (distX*distX + distY*distY) <= (r*r);
  };

  const updateAI = (dt: number, now: number) => {
    playersRef.current.forEach(p => {
      if (p.isBot && !p.isDead) {
        let nearestPotato = null;
        let minPotatoDist = Infinity;
        potatoesRef.current.forEach(pot => {
             const d = Math.hypot(p.position.x - pot.position.x, p.position.y - pot.position.y);
             if (d < minPotatoDist) { minPotatoDist = d; nearestPotato = pot; }
        });
        if (!nearestPotato) return;
        let tx = p.position.x;
        let ty = p.position.y;
        if (minPotatoDist < 400) {
          const dx = p.position.x - nearestPotato.position.x;
          const dy = p.position.y - nearestPotato.position.y;
          tx = p.position.x + dx;
          ty = p.position.y + dy;
          if (minPotatoDist < 150 && p.dashCooldown <= 0) {
             p.dashCooldown = ABILITY_COOLDOWNS.DASH;
             p.speedBoostEndTime = now + ABILITY_DURATIONS.DASH;
             p.speed = BASE_SPEED * 2.5;
             spawnParticles(p.position, 10, p.color);
             // Bot Logic: add effect locally for juice
          }
        } else {
           tx = CANVAS_WIDTH/2 + Math.sin(now * 0.001 + parseFloat(p.id.split('-')[1])) * 500;
           ty = CANVAS_HEIGHT/2 + Math.cos(now * 0.001) * 500;
        }
        movePlayerToward(p, tx, ty, dt);
      }
    });
  };

  const getGridPos = (pos: Vector2) => ({ x: Math.floor(pos.x / GRID_SIZE), y: Math.floor(pos.y / GRID_SIZE) });
  const findPath = (startPos: Vector2, endPos: Vector2): Vector2[] => {
      // Local A* Implementation (Keep this for singleplayer)
      const startNode = getGridPos(startPos);
      const endNode = getGridPos(endPos);
      if (Math.hypot(startPos.x - endPos.x, startPos.y - endPos.y) < GRID_SIZE * 2) return [endPos];
      const cols = Math.ceil(CANVAS_WIDTH / GRID_SIZE);
      const rows = Math.ceil(CANVAS_HEIGHT / GRID_SIZE);
      const openSet: Node[] = [];
      const closedSet = new Set<string>();
      openSet.push({ x: startNode.x, y: startNode.y, f: 0, g: 0, h: 0, parent: null });
      let iterations = 0;
      while (openSet.length > 0 && iterations < 300) {
          iterations++;
          let lowInd = 0;
          for(let i=0; i<openSet.length; i++) if(openSet[i].f < openSet[lowInd].f) lowInd = i;
          const current = openSet[lowInd];
          if (current.x === endNode.x && current.y === endNode.y) {
              const path: Vector2[] = [];
              let temp: Node | null = current;
              while(temp?.parent) {
                  path.push({ x: temp.x * GRID_SIZE + GRID_SIZE/2, y: temp.y * GRID_SIZE + GRID_SIZE/2 });
                  temp = temp.parent;
              }
              return path.reverse();
          }
          openSet.splice(lowInd, 1);
          closedSet.add(`${current.x},${current.y}`);
          const neighbors = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}, {x:-1,y:-1}, {x:1,y:-1}, {x:-1,y:1}, {x:1,y:1}];
          for (const n of neighbors) {
              const nx = current.x + n.x;
              const ny = current.y + n.y;
              if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
              if (closedSet.has(`${nx},${ny}`)) continue;
              const cellRect = { x: nx * GRID_SIZE, y: ny * GRID_SIZE, width: GRID_SIZE, height: GRID_SIZE };
              let blocked = false;
              for (const obs of obstaclesRef.current) {
                  if (cellRect.x < obs.x + obs.width && cellRect.x + cellRect.width > obs.x &&
                      cellRect.y < obs.y + obs.height && cellRect.y + cellRect.height > obs.y) { blocked = true; break; }
              }
              if (blocked) continue;
              const gScore = current.g + 1;
              let gScoreIsBest = false;
              let neighbor = openSet.find(node => node.x === nx && node.y === ny);
              if (!neighbor) { gScoreIsBest = true; neighbor = { x: nx, y: ny, f: 0, g: 0, h: 0, parent: null }; openSet.push(neighbor); } 
              else if (gScore < neighbor.g) gScoreIsBest = true;
              if (gScoreIsBest && neighbor) {
                  neighbor.parent = current; neighbor.g = gScore;
                  neighbor.h = Math.abs(nx - endNode.x) + Math.abs(ny - endNode.y); neighbor.f = neighbor.g + neighbor.h;
              }
          }
      }
      return [endPos];
  };

  const updatePotatoes = (dt: number, now: number) => {
    // Combine base multiplier + debug modifier
    const totalSpeedMultiplier = potatoSpeedMultiplierRef.current + (debugState.potatoSpeedModifier || 0);

    potatoesRef.current.forEach(potato => {
        if (potato.isFrozen && now > potato.freezeEndTime) potato.isFrozen = false;
        if (potato.isFrozen) return;
        let minDst = Infinity; let target: Player | null = null;
        playersRef.current.forEach(p => {
            // Updated Check: Ignore Ghost players
            if (!p.isDead && !p.isHidden && !p.isGhost) {
                const d = Math.hypot(p.position.x - potato.position.x, p.position.y - potato.position.y);
                if (d < minDst) { minDst = d; target = p; }
            }
        });
        potato.targetId = target ? target.id : null;
        if (target) {
            potato.pathUpdateTimer++;
            if (potato.pathUpdateTimer > 15) { potato.pathUpdateTimer = 0; potato.currentPath = findPath(potato.position, target.position); }
            let moveTarget = target.position;
            if (potato.currentPath.length > 0) {
                moveTarget = potato.currentPath[0];
                if (Math.hypot(moveTarget.x - potato.position.x, moveTarget.y - potato.position.y) < potato.radius) {
                    potato.currentPath.shift();
                    if (potato.currentPath.length > 0) moveTarget = potato.currentPath[0];
                }
            }
            const dx = moveTarget.x - potato.position.x;
            const dy = moveTarget.y - potato.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 1) {
                // Apply Speed Multiplier
                const currentSpeed = potato.speed * totalSpeedMultiplier;
                potato.position.x += (dx / dist) * currentSpeed * dt;
                potato.position.y += (dy / dist) * currentSpeed * dt;
            }
        }
        if (framesRef.current % 5 === 0) {
            potato.trail.push({ ...potato.position });
            if (potato.trail.length > 20) potato.trail.shift();
        }
    });
  };

  const checkCollisions = (now: number) => {
    potatoesRef.current.forEach(potato => {
        playersRef.current.forEach(p => {
            if (p.isDead) return;
            const dist = Math.hypot(p.position.x - potato.position.x, p.position.y - potato.position.y);
            if (dist < p.radius + potato.radius) {
                // If Shielded -> Freeze Potato
                if (p.isShielded) {
                    if (!potato.isFrozen) {
                        potato.isFrozen = true;
                        potato.freezeEndTime = now + 1000; // Freeze for 1 second
                        spawnParticles(potato.position, 15, '#22D3EE'); // Cyan particles
                        addFloatingText(p.position, "BLOCKED!", "#22D3EE", 25);
                    }
                } 
                else if (!potato.isFrozen) {
                    // Ghost Mode Check (Client physics safety)
                    if (p.isGhost) return;

                    // God Mode Check
                    if (debugState.godMode && p.id === 'user') return;

                    // Reduce HP
                    p.lives--;
                    spawnParticles(p.position, 30, p.color);
                    addFloatingText(p.position, "-1 HP", "#ff0000", 30);
                    triggerScreenShake(8);

                    if (p.lives <= 0) {
                        p.isDead = true; 
                        spawnParticles(p.position, 50, '#ff0000'); 
                        triggerScreenShake(15);
                        
                        // Increase Potato Speed by 10% on player elimination
                        potatoSpeedMultiplierRef.current += 0.1;
                        if(p.id !== 'user') addNotification(`${p.name} Eliminated!`, "#ff0000");

                        if (p.id === 'user') {
                            // User died in Single Player. Calculate the "Winner" (best bot)
                            const aliveBots = playersRef.current.filter(pl => pl.id !== 'user' && !pl.isDead);
                            const bestBot = aliveBots.length > 0 
                                ? aliveBots.sort((a,b) => b.score - a.score)[0] 
                                : playersRef.current.filter(pl => pl.id !== 'user').sort((a,b) => b.score - a.score)[0];
                            
                            onGameOver(bestBot ? bestBot.id : 'bot-0');
                        }
                    } else {
                        // Respawn logic
                        const spawn = findSafeSpawn();
                        p.position = spawn;
                        p.shieldCooldown = ABILITY_COOLDOWNS.SHIELD; // Auto shield on respawn
                        p.velocity = { x: 0, y: 0 };
                        // Flash effect or similar would go here
                    }
                }
            }
        });
    });
    powerupsRef.current = powerupsRef.current.filter(pu => {
       let collected = false;
       playersRef.current.forEach(p => {
         if (p.isDead) return;
         if (Math.hypot(p.position.x - pu.position.x, p.position.y - pu.position.y) < p.radius + pu.radius) {
           collected = true; 
           applyPowerup(p, pu, now); 
           p.score += 50;
           addFloatingText(p.position, "+50", "#ffff00");
           if (p.id === 'user') addNotification(`Picked up ${pu.type}!`, POWERUP_COLORS[pu.type]);
         }
       });
       return !collected;
    });
  };

  const applyPowerup = (p: Player, pu: Powerup, now: number) => {
    spawnParticles(pu.position, 15, POWERUP_COLORS[pu.type]);
    switch(pu.type) {
      case PowerupType.SPEED: p.speedBoostEndTime = now + 8000; p.speed = BASE_SPEED * 1.5; break;
      case PowerupType.COOLDOWN_RESET: p.dashCooldown = 0; p.shieldCooldown = 0; p.smokeCooldown = 0; p.slimeCooldown = 0; break;
      case PowerupType.FREEZE: potatoesRef.current.forEach(pot => { pot.isFrozen = true; pot.freezeEndTime = now + 3000; }); break;
      case PowerupType.GHOST: p.isGhost = true; setTimeout(() => { p.isGhost = false; }, 5000); break;
    }
  };

  const updatePowerups = (now: number) => {
    if (Math.random() < 0.0016 && powerupsRef.current.length < 5) {
       // Weighted Random: Freeze is rare (5%)
       const r = Math.random();
       let type: PowerupType = PowerupType.SPEED;
       
       if (r < 0.05) type = PowerupType.FREEZE;
       else if (r < 0.20) type = PowerupType.DOUBLE_POINTS;
       else if (r < 0.40) type = PowerupType.SPEED;
       else if (r < 0.60) type = PowerupType.COOLDOWN_RESET;
       else if (r < 0.80) type = PowerupType.GHOST;
       else type = PowerupType.MAGNET;

       let px, py, safe=false;
       while(!safe) {
           px = Math.random() * (CANVAS_WIDTH - 200) + 100; py = Math.random() * (CANVAS_HEIGHT - 200) + 100; safe = true;
           for(const obs of obstaclesRef.current) if(px > obs.x && px < obs.x+obs.width && py > obs.y && py < obs.y+obs.height) safe=false;
       }
       powerupsRef.current.push({ id: Math.random().toString(), type: type, position: { x: px!, y: py! }, spawnTime: now, radius: POWERUP_RADIUS });
    }
  };

  const updateParticles = (dt: number) => {
    particlesRef.current.forEach(p => {
      p.position.x += p.velocity.x * dt * 60; p.position.y += p.velocity.y * dt * 60; p.life -= dt * 2;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };
  
  const updateFloatingText = (dt: number) => {
      floatingTextsRef.current.forEach(ft => {
          ft.y += ft.velocityY * dt;
          ft.life -= dt * 0.8;
      });
      floatingTextsRef.current = floatingTextsRef.current.filter(ft => ft.life > 0);
  };

  const spawnParticles = (pos: Vector2, count: number, color: string) => {
    for(let i=0; i<count; i++) {
      const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 5;
      particlesRef.current.push({ id: Math.random().toString(), position: { ...pos }, velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, color: color, life: 1.0, size: Math.random() * 4 + 2 });
    }
  };

  // --- Rendering ---
  const render = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Clear and Reset Transform
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Apply Fairness Scaling
    // This scales the entire drawing context so 1800 units fits in the window width
    const currentScale = scaleRef.current;
    ctx.scale(currentScale, currentScale);

    let target = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT/2 };
    if (spectatingIdRef.current) {
        if (spectatingIdRef.current === 'POTATO' && potatoesRef.current.length > 0) target = potatoesRef.current[0].position;
        else {
            const p = playersRef.current.find(p => p.id === spectatingIdRef.current);
            if (p) target = p.position;
        }
    } else {
        const myId = settings.isOnline ? socketService.getSocket()?.id : 'user';
        const user = playersRef.current.find(p => p.id === myId);
        if (user && !user.isDead) target = user.position;
    }
    
    // Smooth Camera & Screen Shake
    const viewWidth = ctx.canvas.width / currentScale;
    const viewHeight = ctx.canvas.height / currentScale;
    
    cameraRef.current.x += (target.x - cameraRef.current.x - viewWidth/2) * 0.1;
    cameraRef.current.y += (target.y - cameraRef.current.y - viewHeight/2) * 0.1;

    let shakeX = 0;
    let shakeY = 0;
    
    // Only apply screen shake if enabled in debug settings
    if (debugState.enableScreenShake && screenShakeRef.current > 0) {
        shakeX = (Math.random() - 0.5) * screenShakeRef.current;
        shakeY = (Math.random() - 0.5) * screenShakeRef.current;
        screenShakeRef.current = Math.max(0, screenShakeRef.current - 0.5);
    } else {
        screenShakeRef.current = 0; // Clear it so it doesn't queue up
    }

    ctx.save();
    ctx.translate(-cameraRef.current.x + shakeX, -cameraRef.current.y + shakeY);

    // Grid
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x=0; x<=CANVAS_WIDTH; x+=100) { ctx.moveTo(x,0); ctx.lineTo(x, CANVAS_HEIGHT); }
    for (let y=0; y<=CANVAS_HEIGHT; y+=100) { ctx.moveTo(0,y); ctx.lineTo(CANVAS_WIDTH, y); }
    ctx.stroke();

    // Obstacles
    ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
    obstaclesRef.current.forEach(obs => {
        ctx.shadowColor = 'black'; ctx.shadowBlur = 20; ctx.fillRect(obs.x, obs.y, obs.width, obs.height); ctx.shadowBlur = 0; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.rect(obs.x + 5, obs.y + 5, obs.width - 10, obs.height - 10); ctx.fill(); ctx.fillStyle = '#1e293b';
        if (debugState.showHitboxes) { ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'; ctx.strokeRect(obs.x, obs.y, obs.width, obs.height); }
    });
    
    // Draw Slime Areas (Under players)
    slimeAreasRef.current.forEach(slime => {
       ctx.beginPath();
       ctx.arc(slime.x, slime.y, slime.radius, 0, Math.PI * 2);
       ctx.fillStyle = 'rgba(132, 204, 22, 0.4)'; // Lime green semi-transparent
       ctx.fill();
       ctx.strokeStyle = '#65a30d';
       ctx.lineWidth = 2;
       ctx.stroke();
       
       // Bubbles effect
       if (Math.random() < 0.1) {
           const bx = slime.x + (Math.random() - 0.5) * slime.radius * 1.5;
           const by = slime.y + (Math.random() - 0.5) * slime.radius * 1.5;
           if(Math.hypot(bx - slime.x, by - slime.y) < slime.radius) {
               ctx.fillStyle = '#bef264';
               ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
           }
       }
    });

    // Boundary
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 5; ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Powerups with Emojis
    powerupsRef.current.forEach(pu => {
      // Background Glow only (No Circle)
      ctx.shadowColor = POWERUP_COLORS[pu.type];
      ctx.shadowBlur = 30;
      
      // Emoji - Increased size, No Circle
      ctx.font = '42px Arial'; 
      ctx.textAlign = 'center'; 
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff'; 
      ctx.fillText(POWERUP_EMOJIS[pu.type], pu.position.x, pu.position.y + 4);
      
      // Reset Shadow
      ctx.shadowBlur = 0;

      if (debugState.showHitboxes) { ctx.strokeStyle = '#00ff00'; ctx.beginPath(); ctx.arc(pu.position.x, pu.position.y, pu.radius, 0, Math.PI*2); ctx.stroke(); }
    });

    // Potatoes
    potatoesRef.current.forEach(potato => {
        // Decide which trail source to use: Local visual trails for online (smooth), or potato's own trail property for offline
        const trailToDraw = settings.isOnline ? localPotatoTrailsRef.current : potato.trail;
        
        ctx.beginPath(); 
        trailToDraw.forEach((pos, i) => { if (i===0) ctx.moveTo(pos.x, pos.y); else ctx.lineTo(pos.x, pos.y); });
        ctx.strokeStyle = `rgba(255, 100, 0, 0.4)`; ctx.lineWidth = potato.radius; ctx.lineCap = 'round'; ctx.stroke();
        
        ctx.beginPath(); ctx.arc(potato.position.x, potato.position.y, potato.radius, 0, Math.PI*2);
        ctx.fillStyle = potato.isFrozen ? '#06b6d4' : '#ff4500'; ctx.shadowBlur = 30; ctx.shadowColor = potato.isFrozen ? '#06b6d4' : '#ff4500'; ctx.fill(); ctx.shadowBlur = 0;

        // Frozen Effect
        if (potato.isFrozen) {
           ctx.font = '20px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
           ctx.fillText(BUFF_EMOJIS.FROZEN, potato.position.x, potato.position.y);
        }

        if (debugState.showPathfinding && potato.currentPath.length > 0) {
           ctx.strokeStyle = '#ffff00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(potato.position.x, potato.position.y); potato.currentPath.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
        }
    });

    // Players
    playersRef.current.forEach(p => {
      if (p.isDead) return;
      if (p.isHidden && p.id !== (settings.isOnline ? socketService.getSocket()?.id : 'user') && spectatingIdRef.current !== p.id) return; 

      ctx.save(); ctx.translate(p.position.x, p.position.y);
      if (p.isShielded) { ctx.beginPath(); ctx.arc(0, 0, p.radius + 8, 0, Math.PI*2); ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI*2); ctx.fillStyle = p.color;
      if (p.isHidden || p.isGhost) ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
      
      // Overhead Name & Score (Simplified)
      ctx.fillStyle = 'white'; ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center'; 
      ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
      ctx.fillText(p.name, 0, -p.radius - 10);
      ctx.shadowBlur = 0;

      // Active Buff Emojis (Overhead)
      let buffEmoji = '';
      if (p.isShielded) buffEmoji += BUFF_EMOJIS.SHIELD;
      if (p.speed > BASE_SPEED * 1.1) buffEmoji += BUFF_EMOJIS.SPEED;
      if (p.isGhost) buffEmoji += BUFF_EMOJIS.GHOST;
      if (p.isHidden) buffEmoji += BUFF_EMOJIS.SMOKE;
      if (p.isSilenced) buffEmoji += BUFF_EMOJIS.SILENCED;
      if (p.isSlowed) buffEmoji += BUFF_EMOJIS.SLOWED;

      if (buffEmoji) {
         ctx.font = '20px Arial';
         ctx.fillText(buffEmoji, 0, -p.radius - 30);
      }
      
      // God Mode Halo
      if (debugState.godMode && p.id === 'user') {
          ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0,0, p.radius + 5, 0, Math.PI*2); ctx.stroke();
      }
      
      ctx.restore();
    });

    // Floating Texts
    floatingTextsRef.current.forEach(ft => {
        ctx.font = `bold ${ft.size}px Arial`;
        ctx.fillStyle = ft.color;
        ctx.globalAlpha = ft.life;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
    });

    particlesRef.current.forEach(p => {
      ctx.beginPath(); ctx.arc(p.position.x, p.position.y, p.size * p.life, 0, Math.PI*2); ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fill(); ctx.globalAlpha = 1;
    });

    ctx.restore();

    // Draw UI Notifications (Top Center, fixed screen position)
    const activeNotifications = notificationsRef.current.filter(n => Date.now() < n.spawnTime + n.duration);
    notificationsRef.current = activeNotifications;
    
    // Scale UI Context back to 1:1 for crisp text
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    let notifY = 180; // Start below the health bar
    activeNotifications.forEach(n => {
        const elapsed = Date.now() - n.spawnTime;
        const fadeStart = n.duration - 500; // Start fading out 500ms before end
        let alpha = 1.0;
        
        if (elapsed > fadeStart) {
            alpha = Math.max(0, 1 - (elapsed - fadeStart) / 500);
        }

        ctx.globalAlpha = alpha;
        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = n.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'black'; ctx.shadowBlur = 4;
        ctx.strokeText(n.text, ctx.canvas.width / 2, notifY);
        ctx.fillText(n.text, ctx.canvas.width / 2, notifY);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
        
        notifY += 30;
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      // We need to account for the Scale when calculating mouse pos
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      // Apply inverse scale
      const gameX = screenX / scaleRef.current;
      const gameY = screenY / scaleRef.current;

      mouseRef.current = { x: cameraRef.current.x + gameX, y: cameraRef.current.y + gameY };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== GameState.PLAYING) return;
      // Online Input
      if(settings.isOnline) {
          socketService.getSocket()?.emit('input', { x: mouseRef.current.x, y: mouseRef.current.y, key: e.key.toLowerCase() });
          return;
      }
      // Local Input
      const user = playersRef.current.find(p => p.id === 'user');
      if (!user || user.isDead) return;
      
      // Single Player Silence Check
      if (user.isSilenced) return;

      const now = Date.now();
      switch(e.key.toLowerCase()) {
        case 'q': if (user.dashCooldown <= 0 || debugState.infiniteAbilities) { user.dashCooldown = ABILITY_COOLDOWNS.DASH; user.speedBoostEndTime = now + ABILITY_DURATIONS.DASH; user.speed = BASE_SPEED * 2.5; spawnParticles(user.position, 10, '#ffffff'); } break;
        case 'w': if (user.shieldCooldown <= 0 || debugState.infiniteAbilities) user.shieldCooldown = ABILITY_COOLDOWNS.SHIELD; break;
        case 'e': if (user.smokeCooldown <= 0 || debugState.infiniteAbilities) { user.smokeCooldown = ABILITY_COOLDOWNS.SMOKE; spawnParticles(user.position, 20, '#64748b'); } break;
        case 'r': if (user.slimeCooldown <= 0 || debugState.infiniteAbilities) {
             user.slimeCooldown = ABILITY_COOLDOWNS.SLIME;
             slimeAreasRef.current.push({
                 id: Math.random().toString(),
                 ownerId: user.id,
                 x: user.position.x,
                 y: user.position.y,
                 radius: SLIME_RADIUS,
                 spawnTime: now,
                 duration: ABILITY_DURATIONS.SLIME
             });
        } break;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, settings.isOnline, debugState.infiniteAbilities]);

  return (
    <canvas 
      ref={canvasRef} 
      className="block bg-slate-900 cursor-crosshair w-full h-full"
    />
  );
});

export default GameCanvas;