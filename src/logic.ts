import type { PlayerId, RuneClient } from "rune-games-sdk/multiplayer"

// change this to generate a different game
export const LEVELS_SEED = 1

export const VIEW_HEIGHT = 800 * 2;
export const VIEW_WIDTH = 500 * 2;
export const SPEED_SCALE = 2;
export const MOVE_SPEED = 13 * SPEED_SCALE;
export const ROCK_MAX_SPEED = 12 * SPEED_SCALE;
export const BULLET_SPEED = 40 * SPEED_SCALE;
export const PARTICLE_SPEED = 20 * SPEED_SCALE;
export const ENEMY_MOVE_SPEED = 30 * SPEED_SCALE;
export const GUN_TEMP_PER_SHOT = 0.02;
export const GUN_TEMP_COOL_DOWN = 0.04;
export const PHASE_START_TIME = 4000;
export const POWER_UP_DRIFT_SPEED = 4 * SPEED_SCALE;

export type ParticleType = "ROCK" | "STAR1" | "STAR2" | "STAR3";

export const MESSAGES = [
  "All your base are belong to us",
  "Nuke from orbit only way to be sure",
  "Someone set up us the bomb",
  "I'll be back",
  "You have no chance to survive, make your time",
  "Do. Or do not. There is no try",
  "We are an impossibility in an impossible universe",
  "You are on the way to destruction",
  "Dead or alive, you're coming with me!",
  "For great justice",
  "Khaaaaaaaaan!",
  "Take off every zig!!",
  "By Grabthar’s hammer, by the suns of Worvan, you shall be avenged",
];

type Point = {
  x: number,
  y: number,
}

const controlPoints: Point[] = [];
const exitPoints: Point[] = [];
const entryPoints: Point[] = [];

for (let x = 0; x < 3; x++) {
  for (let y = 0; y < 5; y++) {
    controlPoints.push({
      x: (VIEW_WIDTH * 0.2) + (x * VIEW_WIDTH * 0.2),
      y: (VIEW_HEIGHT * 0.1) + (y * VIEW_HEIGHT * 0.15)
    })
  }
}

export type Persisted = {
  bestPhase: number,
  bestScore: number,
}

entryPoints.push({ x: -50, y: -50 });
entryPoints.push({ x: VIEW_WIDTH + 50, y: -50 });
entryPoints.push({ x: -50, y: VIEW_HEIGHT * 0.25 });
entryPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.25 });
entryPoints.push({ x: -50, y: VIEW_HEIGHT * 0.5 });
entryPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.5 });

exitPoints.push(...entryPoints);
exitPoints.push({ x: -50, y: VIEW_HEIGHT * 0.65 });
exitPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.65 });
exitPoints.push({ x: -50, y: VIEW_HEIGHT * 0.65 });
exitPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.65 });

function mulberry32(a: number) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const seededRandomNumbers: number[] = [];
const initialSeededRandomNumber = mulberry32(LEVELS_SEED);
for (let i = 0; i < 5000; i++) {
  seededRandomNumbers[i] = initialSeededRandomNumber();
}

export type EnemyWaveType = "SINGLE" | "FLOW";

export type EnemyColor = "Black" | "Blue" | "Green" | "Red";
export const EnemyColors: EnemyColor[] = ["Black", "Blue", "Green", "Red"];

export type PointAndWait = Point & {
  wait: number
};

export type Phase = {
  enemyInterval: number;
  rockInterval: number;
  bomberPause: number;
  speedModifier: number;
  enemyCount: number;
  msg: string;
}

export type EnemyPath = PointAndWait[];

export type PowerUpType = "DOUBLE_SHOT" | "FAST_FIRE" | "HEALTH" | "SHIELD" | "SPEED";
export const powerUpTypes: PowerUpType[] = ["DOUBLE_SHOT", "FAST_FIRE", "HEALTH", "SHIELD", "SPEED"];

export type PowerUp = GameElement & {
  type: PowerUpType;
}
export type Enemy = GameElement & {
  start: number;
  waitUntil: number;
  path: EnemyPath;
  pt: number;
  shoot: boolean;
  col: EnemyColor;
  index: number;
  speed: number;
  pos: number;
  lastHit: number;
  health: number;
  value: number;
  needsShoot: boolean;
  wave: number;
}

export type Controls = {
  x: number;
  y: number;
  fire: boolean;
}

export type GameElement = {
  id: number;
  x: number;
  y: number;
  radius: number;
}

export type Bullet = GameElement & {
  vy: number;
  vx: number,
  radius: number;
  owner: number;
  ownerIndex: number;
  type: "PLAYER" | "ENEMY";
}

export type Particle = GameElement & {
  vx: number;
  vy: number;
  type: ParticleType;
}

export type Rock = GameElement & {
  vy: number;
  r: number;
  radius: number;
}

export type Player = GameElement & {
  health: number;
  index: number;
  playerId: string;
  controls: { x: number, y: number, fire: boolean },
  lastFire: number;
  radius: number;
  lastHit: number;
  fireInterval: number;
  score: number;
  gunTemp: number;
  shots: number;
  maxHealth: number;
  moveModifier: number;
}

export type GameEvent = {
  type: "FIRE" | "EXPLODE" | "HIT" | "DIE" | "COLLECT";
  who?: string;
}

export interface GameState {
  persisted?: Record<PlayerId, Persisted>;
  events: GameEvent[];
  particles: Particle[];
  bullets: Bullet[];
  players: Player[];
  enemies: Enemy[];
  powerUps: PowerUp[];
  rocks: Rock[];
  lastRock: number;
  nextId: number;
  nextPlayerIndex: number;
  lastEnemy: number;
  phase: number;
  nextRandom: number;
  phaseStart: number;
  phaseInfo: Phase;
  waveCounts: number[];
}

export type GameActions = {
  controls: (params: { x: number, y: number, fire: boolean }) => void
  join: () => void;
}

declare global {
  const Rune: RuneClient<GameState, GameActions, Persisted>
}

function collide(a: GameElement, b: GameElement): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rad = a.radius + b.radius;

  return ((dx * dx) + (dy * dy)) < (rad * rad);
}

function addPlayer(allPlayerIds: PlayerId[], state: GameState, id: string) {
  const index = state.nextPlayerIndex++;
  state.players.push({
    playerId: id,
    id: state.nextId++,
    x: 200 + (index * 125),
    y: VIEW_HEIGHT - 400,
    index: allPlayerIds.indexOf(id),
    health: 3,
    controls: { x: 0, y: 0, fire: false },
    lastFire: 0,
    radius: 20,
    lastHit: -10000, // set it in the past so they don't suddenly get a hit marker,
    fireInterval: 150,
    score: 0,
    gunTemp: 0,
    shots: 1,
    maxHealth: 3,
    moveModifier: 0.75
  })
}

function bulletSpray(game: GameState, element: Enemy, count: number): void {
  const speed = PARTICLE_SPEED;
  const step = Math.PI / (count - 1);
  const offset = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const ang = offset + (step * i);
    game.bullets.push({ id: game.nextId++, x: element.x, y: element.y, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed, type: "ENEMY", ownerIndex: element.id, radius: 2, owner: -1 });
  }
}

function particleSpray(game: GameState, type: ParticleType, element: GameElement, count: number): void {
  const speed = PARTICLE_SPEED;
  const step = (Math.PI * 2) / count;
  const offset = Math.random() * Math.PI;
  for (let i = 0; i < count; i++) {
    const ang = offset + (step * i);
    game.particles.push({ id: game.nextId++, x: element.x, y: element.y, vx: Math.sin(ang) * speed, vy: Math.cos(ang) * speed, type, radius: 1 });
  }
}

function createPhase(index: number): Phase {
  index--;

  return {
    enemyInterval: Math.max(1000, 5250 - (index * 150)),
    rockInterval: Math.max(6000 - (index * 25)),
    bomberPause: Math.max(3000 - (index * 100)),
    speedModifier: Math.max(1.5, 1 + (index * 0.01)),
    enemyCount: 5 + (index * 2),
    msg: MESSAGES[index % MESSAGES.length]
  }
}

function startPhase(game: GameState): void {
  game.phase++;
  game.phaseStart = Rune.gameTime() + PHASE_START_TIME;
  game.phaseInfo = createPhase(game.phase);
}

function resetGame(game: GameState): void {
  game.lastEnemy = Rune.gameTime();
  game.phase = 0;
  game.nextRandom = 0;
  game.enemies = [];
  game.rocks = [];
  game.bullets = [];
  game.particles = [];
  game.waveCounts = [];
  game.powerUps = [];
  startPhase(game);
}

function randomInContextOfGame(game: GameState): number {
  return seededRandomNumbers[game.nextRandom++ % seededRandomNumbers.length];
}

function spawnEnemy(game: GameState): number {
  if (game.phaseInfo.enemyCount <= 0) {
    startPhase(game);
    return 0;
  }

  game.phaseInfo.enemyCount--;

  const rand = () => { return randomInContextOfGame(game) }

  const startPoint = entryPoints[Math.floor(rand() * entryPoints.length)];
  const possibleExists = exitPoints.filter(e => e.x !== startPoint.x);
  const exitPoint = possibleExists[Math.floor(rand() * possibleExists.length)];
  const moveSpeed = ENEMY_MOVE_SPEED * (0.75 + (rand() * 0.25)) * getPhase(game).speedModifier;

  if (rand() > 0.25) {
    const pts: PointAndWait[] = [];
    for (let i = 0; i < 1 + rand() * 2; i++) {
      pts.push({ ...controlPoints[Math.floor(rand() * controlPoints.length)], wait: 0 });
    }

    const count = Math.floor((rand() * 3) + 5);
    const index = Math.floor(rand() * 5);
    const col = rand() > 0.5 ? "Red" : "Green";

    // flow
    for (let i = 0; i < count; i++) {
      game.enemies.push({
        x: startPoint.x,
        y: startPoint.y,
        id: game.nextId++,
        radius: 70,
        start: Rune.gameTime(),
        waitUntil: Rune.gameTime() + (i * 500),
        index,
        col,
        pt: 1,
        path: [{ ...startPoint, wait: 0 }, ...pts, { ...exitPoint, wait: 0 }],
        shoot: false,
        speed: moveSpeed / 2,
        pos: 0,
        health: 1,
        lastHit: -20000, // not invulnerable to start with,
        needsShoot: false,
        value: 100,
        wave: game.phaseInfo.enemyCount
      })
    }
    game.waveCounts[game.phaseInfo.enemyCount] = count;

    return 0;
  } else {
    // single sit and shoot
    const bombingPoints = controlPoints.filter(p => p.y < VIEW_HEIGHT / 2);
    const count = game.phase > 5 ? 3 : game.phase > 2 ? 2 : 1;
    const col = rand() > 0.5 ? "Blue" : "Black";
    const index = Math.floor(rand() * 5);

    for (let i = 0; i < count; i++) {
      const singleControlPoint = bombingPoints[Math.floor(rand() * bombingPoints.length)];
      bombingPoints.splice(bombingPoints.indexOf(singleControlPoint), 1);

      game.enemies.push({
        x: startPoint.x,
        y: startPoint.y,
        id: game.nextId++,
        radius: 70,
        start: Rune.gameTime(),
        waitUntil: 0,
        index,
        col,
        pt: 1,
        path: [{ ...startPoint, wait: 0 }, { ...singleControlPoint, wait: getPhase(game).bomberPause }, { ...exitPoint, wait: 0 }],
        shoot: true,
        speed: moveSpeed,
        pos: 0,
        health: 4,
        lastHit: -20000, // not invulnerable to start with,
        needsShoot: false,
        value: 100 * 4,
        wave: game.phaseInfo.enemyCount
      })
    }
  }

  return 500;
}

function collectPowerUp(game: GameState, player: Player, powerUp: PowerUp): void {
  if (powerUp.type === "DOUBLE_SHOT") {
    player.shots = 2;
  }
  if (powerUp.type === "SHIELD") {
    player.maxHealth = 4;
  }
  if (powerUp.type === "HEALTH") {
    player.health = Math.min(player.health + 1, player.maxHealth);
  }
  if (powerUp.type === "FAST_FIRE") {
    player.fireInterval = 110;
  }
  if (powerUp.type === "SPEED") {
    player.moveModifier = 1;
  }

  particleSpray(game, "STAR3", powerUp, 8);
  game.events.push({
    type: "COLLECT",
    who: player.playerId
  })

}

function spawnPowerUp(game: GameState, target: GameElement): void {
  // only spawn 1 in 3
  if (Math.random() > (game.phase < 3 ? 0.8 : game.phase < 10 ? 0.5 : 0.3)) {
    return;
  }

  game.powerUps.push({
    x: target.x,
    y: target.y,
    id: game.nextId++,
    radius: 30,
    type: powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)]
  })
}

function damageEnemy(game: GameState, enemy: Enemy, remove?: Bullet): void {
  enemy.health--;
  if (remove) {
    game.bullets.splice(game.bullets.indexOf(remove), 1);
  }

  enemy.lastHit = Rune.gameTime();

  if (enemy.health <= 0) {
    if (remove) {
      const player = game.players.find(p => p.id === remove.owner);
      if (player) {
        player.score += enemy.value;
      }
    }

    if (game.waveCounts[enemy.wave]) {
      game.waveCounts[enemy.wave]--;
      if (game.waveCounts[enemy.wave] === 0) {
        // killed all the enemies in a wave, spawn power up
        spawnPowerUp(game, enemy);
        delete game.waveCounts[enemy.wave];
      }
    }

    // remove rock and bullet
    game.enemies.splice(game.enemies.indexOf(enemy), 1);
    // add particles
    particleSpray(game, "STAR1", enemy, 8);

    game.events.push({
      type: "EXPLODE"
    })
  }
}

function explodeRock(game: GameState, rock: Rock, remove?: Bullet): void {
  // remove rock and bullet
  game.rocks.splice(game.rocks.indexOf(rock), 1);
  if (remove) {
    game.bullets.splice(game.bullets.indexOf(remove), 1);
  }
  // add particles
  particleSpray(game, "ROCK", rock, 8);

  game.events.push({
    type: "EXPLODE"
  })
}

function takeDamage(game: GameState, player: Player) {
  const lastHit = Rune.gameTime() - player.lastHit;
  if (lastHit > 3000) {
    player.health--;
    player.lastHit = Rune.gameTime();

    if (player.health <= 0) {
      game.players.splice(game.players.indexOf(player), 1);
      particleSpray(game, "STAR2", player, 10);
      game.events.push({
        type: "DIE",
        who: player.playerId
      });
    } else {
      game.events.push({
        type: "HIT",
        who: player.playerId
      });
    }
  }
}

export function getPhase(game: GameState): Phase {
  return game.phaseInfo;
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 4,
  setup: () => {
    const state: GameState = {
      events: [],
      particles: [],
      players: [],
      enemies: [],
      bullets: [],
      rocks: [],
      lastRock: -2000,
      nextId: 1,
      nextPlayerIndex: 0,
      lastEnemy: 0,
      phase: 0,
      nextRandom: 0,
      phaseStart: 0,
      phaseInfo: createPhase(0),
      waveCounts: [],
      powerUps: []
    }

    return state;
  },
  updatesPerSecond: 20,
  update: (context) => {
    // const game: GameState = JSON.parse(JSON.stringify(context.game));
    const game = context.game;
    game.events = [];

    for (const particle of [...game.particles]) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > VIEW_WIDTH || particle.y < 0 || particle.y > VIEW_HEIGHT) {
        game.particles.splice(game.particles.indexOf(particle), 1);
      }
    }

    if (game.players.length === 0) {
      return;
    }

    for (const player of game.players) {
      if (!game.persisted[player.playerId].bestScore || game.persisted[player.playerId].bestScore < player.score) {
        game.persisted[player.playerId].bestScore = player.score;
        game.persisted[player.playerId].bestPhase = game.phase;
      }

      player.x += player.controls.x * MOVE_SPEED * player.moveModifier;
      player.y += player.controls.y * MOVE_SPEED * player.moveModifier;

      player.x = Math.min(Math.max(0, player.x), VIEW_WIDTH);
      player.y = Math.min(Math.max(0, player.y), VIEW_HEIGHT);

      if (player.controls.fire && Rune.gameTime() - player.lastFire > player.fireInterval * (player.gunTemp > 0.9 ? 2 : 1)) {
        if (player.shots === 2) {
          game.bullets.push({
            id: game.nextId++,
            x: player.x - 20,
            y: player.y + 5,
            radius: 5,
            vy: -BULLET_SPEED,
            vx: 0,
            ownerIndex: player.index,
            owner: player.id,
            type: "PLAYER"
          })
          game.bullets.push({
            id: game.nextId++,
            x: player.x + 20,
            y: player.y + 5,
            radius: 5,
            vy: -BULLET_SPEED,
            vx: 0,
            ownerIndex: player.index,
            owner: player.id,
            type: "PLAYER"
          })
          player.gunTemp += GUN_TEMP_PER_SHOT;
          player.gunTemp += GUN_TEMP_PER_SHOT;
        } else {
          game.bullets.push({
            id: game.nextId++,
            x: player.x,
            y: player.y,
            radius: 5,
            vy: -BULLET_SPEED,
            vx: 0,
            ownerIndex: player.index,
            owner: player.id,
            type: "PLAYER"
          })
          player.gunTemp += GUN_TEMP_PER_SHOT;
        }
        game.events.push({
          type: "FIRE",
          who: player.playerId
        })
        player.lastFire = Rune.gameTime();
        if (player.gunTemp > 1) {
          player.gunTemp = 1;
        }
      }

      if (!player.controls.fire) {
        player.gunTemp -= GUN_TEMP_COOL_DOWN;
        if (player.gunTemp < 0) {
          player.gunTemp = 0;
        }
      }
    }

    for (const powerUp of [...game.powerUps]) {
      powerUp.y += POWER_UP_DRIFT_SPEED;
      if (powerUp.y > VIEW_HEIGHT) {
        game.powerUps.splice(game.powerUps.indexOf(powerUp), 1);
      } else {
        for (const player of [...game.players]) {
          if (collide(player, powerUp)) {
            game.powerUps.splice(game.powerUps.indexOf(powerUp), 1);
            collectPowerUp(game, player, powerUp);
            break;
          }
        }
      }
    }

    for (const bullet of [...game.bullets]) {
      bullet.x += bullet.vx;
      bullet.y += bullet.vy;
      if (bullet.y < - 50 || bullet.y > VIEW_HEIGHT + 50 || bullet.x < -50 || bullet.x > VIEW_WIDTH + 50) {
        game.bullets.splice(game.bullets.indexOf(bullet), 1);
      }

      if (bullet.type === "ENEMY") {
        for (const player of [...game.players]) {
          if (collide(player, bullet)) {
            game.bullets.splice(game.bullets.indexOf(bullet), 1);
            takeDamage(game, player);
          }
        }
      }
    }

    for (const rock of [...game.rocks]) {
      rock.y += rock.vy;
      if (rock.y > VIEW_HEIGHT + 100) {
        game.rocks.splice(game.rocks.indexOf(rock), 1);
      }

      for (const bullet of game.bullets.filter(b => b.type === "PLAYER")) {
        if (collide(bullet, rock)) {
          explodeRock(game, rock, bullet);
        }
      }
      for (const player of [...game.players]) {
        if (collide(player, rock)) {
          explodeRock(game, rock);
          takeDamage(game, player);
        }
      }
    }

    // can move the ship at phase start
    if (game.phaseStart > Rune.gameTime()) {
      return;
    }


    if (Rune.gameTime() - context.game.lastEnemy > getPhase(game).enemyInterval) {
      context.game.lastEnemy = Rune.gameTime() - spawnEnemy(context.game);
    }

    if (Rune.gameTime() - game.lastRock > getPhase(game).rockInterval) {
      game.rocks.push({
        id: game.nextId++,
        x: Math.random() * VIEW_WIDTH,
        y: 0,
        r: Math.random() * Math.PI * 2,
        vy: ((Math.random() * 5) + 2) * SPEED_SCALE,
        radius: 50
      })
      game.lastRock = Rune.gameTime();
    }

    for (const enemy of [...game.enemies]) {
      for (const bullet of game.bullets.filter(b => b.type === "PLAYER")) {
        if (collide(bullet, enemy)) {
          damageEnemy(game, enemy, bullet);
          continue;
        }
      }
      const lastHit = Rune.gameTime() - enemy.lastHit;
      if (lastHit > 3000) {
        for (const player of [...game.players]) {
          if (collide(enemy, player)) {
            damageEnemy(game, enemy);
            takeDamage(game, player);
          }
        }
      }

      if (enemy.shoot) {
        if (enemy.waitUntil - Rune.gameTime() < 500 && enemy.needsShoot) {
          enemy.needsShoot = false;
          bulletSpray(game, enemy, 4 + Math.min(4, Math.floor(game.phase / 3)) + Math.floor(Math.random() * 4));
        }
      }

      /// enemy move if not waiting
      if (enemy.waitUntil < Rune.gameTime()) {
        const dx = enemy.path[enemy.pt].x - enemy.path[enemy.pt - 1].x;
        const dy = enemy.path[enemy.pt].x - enemy.path[enemy.pt - 1].x;
        const len = Math.sqrt((dx * dx) + (dy * dy));
        enemy.pos += enemy.speed / len
        if (enemy.pos > 1) {
          enemy.pos = 1;
        }

        if (len > 0) {
          enemy.x = ((1 - enemy.pos) * enemy.path[enemy.pt - 1].x) + (enemy.pos * enemy.path[enemy.pt].x) + (Math.sin(Math.PI * enemy.pos) * (dy / len) * 100)
          enemy.y = ((1 - enemy.pos) * enemy.path[enemy.pt - 1].y) + (enemy.pos * enemy.path[enemy.pt].y) + (Math.sin(Math.PI * enemy.pos) * (dx / len) * 100)
        }
        if (enemy.pos >= 1 || len === 0) {
          enemy.waitUntil = Rune.gameTime() + enemy.path[enemy.pt].wait;
          enemy.needsShoot = true;
          enemy.pt++;
          enemy.pos = 0;

          // reached end of the path
          if (!enemy.path[enemy.pt]) {
            game.enemies.splice(game.enemies.indexOf(enemy), 1);
          }
        }
      }
    }

    // Object.assign(context.game, game);
  },
  actions: {
    controls: ({ x, y, fire }, context) => {
      const player = context.game.players.find(p => p.playerId === context.playerId);
      if (player) {
        player.controls.x = x;
        player.controls.y = y;
        player.controls.fire = fire;
      }
    },
    join: (_, context) => {
      if (context.game.players.length === 0) {
        resetGame(context.game);
      }

      if (!context.game.players.find(p => p.playerId === context.playerId)) {

        addPlayer(context.allPlayerIds, context.game, context.playerId)
      }

    }
  },
  persistPlayerData: true,
  events: {
    playerJoined: () => {
    },
    playerLeft: (id, context) => {
      context.game.players = context.game.players.filter((p) => p.playerId !== id)
    },
  },
})
