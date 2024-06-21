import type { RuneClient } from "rune-games-sdk/multiplayer"

export const VIEW_HEIGHT = 800 * 2;
export const VIEW_WIDTH = 500 * 2;
export const SPEED_SCALE = 2;
export const MOVE_SPEED = 10 * SPEED_SCALE;
export const ROCK_MAX_SPEED = 12 * SPEED_SCALE;
export const BULLET_SPEED = 40 * SPEED_SCALE;
export const PARTICLE_SPEED = 20 * SPEED_SCALE;
export const ENEMY_MOVE_SPEED = 40 * SPEED_SCALE;
export const GUN_TEMP_PER_SHOT = 0.02;
export const GUN_TEMP_COOL_DOWN = 0.04;

export type ParticleType = "ROCK" | "STAR1" | "STAR2" | "STAR3";

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

entryPoints.push({ x: -50, y: -50 });
entryPoints.push({ x: VIEW_WIDTH + 50, y: -50 });
entryPoints.push({ x: -50, y: VIEW_HEIGHT * 0.25 });
entryPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.25 });
entryPoints.push({ x: -50, y: VIEW_HEIGHT * 0.5 });
entryPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.5 });

exitPoints.push(...entryPoints);
exitPoints.push({ x: -50, y: VIEW_HEIGHT * 0.75 });
exitPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.75 });
exitPoints.push({ x: -50, y: VIEW_HEIGHT * 0.75 });
exitPoints.push({ x: VIEW_WIDTH + 50, y: VIEW_HEIGHT * 0.75 });

function mulberry32(a: number) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const seededRandomNumbers: number[] = [];
const initialSeededRandomNumber = mulberry32(12345);
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
}

const _PHASES: Phase[] = [
  { enemyInterval: 6000, rockInterval: 5000, bomberPause: 3000, speedModifier: 1 },
  { enemyInterval: 6000, rockInterval: 5000, bomberPause: 3000, speedModifier: 1 },
]

export type EnemyPath = PointAndWait[];

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
  bulletSize: number;
  fireInterval: number;
  score: number;
  gunTemp: number;
}

export type GameEvent = {
  type: "FIRE" | "EXPLODE" | "HIT" | "DIE";
  who?: string;
}

export interface GameState {
  events: GameEvent[];
  particles: Particle[];
  bullets: Bullet[];
  players: Player[];
  enemies: Enemy[];
  rocks: Rock[];
  lastRock: number;
  nextId: number;
  nextPlayerIndex: number;
  lastEnemy: number;
  phase: number;
  nextRandom: number;
}

export type GameActions = {
  controls: (params: { x: number, y: number, fire: boolean }) => void
  join: () => void;
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

function collide(a: GameElement, b: GameElement): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rad = a.radius + b.radius;

  return ((dx * dx) + (dy * dy)) < (rad * rad);
}

function addPlayer(state: GameState, id: string) {
  const index = state.nextPlayerIndex++;
  state.players.push({
    playerId: id,
    id: state.nextId++,
    x: 200 + (index * 125),
    y: VIEW_HEIGHT - 400,
    index,
    health: 3,
    controls: { x: 0, y: 0, fire: false },
    lastFire: 0,
    radius: 20,
    lastHit: -10000, // set it in the past so they don't suddenly get a hit marker,
    bulletSize: 5,
    fireInterval: 150,
    score: 0,
    gunTemp: 0,
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

function resetGame(game: GameState): void {
  game.lastEnemy = Rune.gameTime();
  game.phase = 0;
  game.nextRandom = 0;
  game.enemies = [];
  game.rocks = [];
  game.bullets = [];
  game.particles = [];
  game.lastEnemy = -getPhase(game).enemyInterval;
}

function randomInContextOfGame(game: GameState): number {
  return seededRandomNumbers[game.nextRandom++ % seededRandomNumbers.length];
}

function spawnEnemy(game: GameState): number {
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

    const count = (rand() * 3) + 5;
    const index = Math.floor(rand() * 5);
    const col = rand() > 0.5 ? "Red" : "Green";

    // flow
    for (let i = 0; i < count; i++) {
      game.enemies.push({
        x: startPoint.x,
        y: startPoint.y,
        id: game.nextId++,
        radius: 50,
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
        value: 100
      })
    }

    return 0;
  } else {
    // single sit and shoot
    const bombingPoints = controlPoints.filter(p => p.y < VIEW_HEIGHT / 2);
    const singleControlPoint = bombingPoints[Math.floor(rand() * bombingPoints.length)];

    game.enemies.push({
      x: startPoint.x,
      y: startPoint.y,
      id: game.nextId++,
      radius: 50,
      start: Rune.gameTime(),
      waitUntil: 0,
      index: Math.floor(rand() * 5),
      col: rand() > 0.5 ? "Blue" : "Black",
      pt: 1,
      path: [{ ...startPoint, wait: 0 }, { ...singleControlPoint, wait: getPhase(game).bomberPause }, { ...exitPoint, wait: 0 }],
      shoot: true,
      speed: moveSpeed,
      pos: 0,
      health: 4,
      lastHit: -20000, // not invulnerable to start with,
      needsShoot: false,
      value: 100 * 4
    })
  }

  return 500;
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
  return _PHASES[Math.min(_PHASES.length, game.phase)];
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 4,
  setup: (allPlayerIds) => {
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
    }

    // delay first enemy
    state.lastEnemy = -getPhase(state).enemyInterval / 2;
    
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

    if (Rune.gameTime() - context.game.lastEnemy > getPhase(game).enemyInterval) {
      context.game.lastEnemy = Rune.gameTime() - spawnEnemy(context.game);
    }

    for (const player of game.players) {
      player.x += player.controls.x * MOVE_SPEED;
      player.y += player.controls.y * MOVE_SPEED;

      player.x = Math.min(Math.max(0, player.x), VIEW_WIDTH);
      player.y = Math.min(Math.max(0, player.y), VIEW_HEIGHT);

      if (player.controls.fire && Rune.gameTime() - player.lastFire > player.fireInterval * (player.gunTemp > 0.9 ? 2 : 1)) {
        game.bullets.push({
          id: game.nextId++,
          x: player.x,
          y: player.y,
          radius: player.bulletSize,
          vy: -BULLET_SPEED,
          vx: 0,
          ownerIndex: player.index,
          owner: player.id,
          type: "PLAYER"
        })
        game.events.push({
          type: "FIRE",
          who: player.playerId
        })
        player.lastFire = Rune.gameTime();
        player.gunTemp += GUN_TEMP_PER_SHOT;
      }

      if (!player.controls.fire) {
        player.gunTemp -= GUN_TEMP_COOL_DOWN;
        if (player.gunTemp < 0) {
          player.gunTemp = 0;
        }
      }
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
          bulletSpray(game, enemy, 8 + Math.floor(Math.random() * 4));
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

        addPlayer(context.game, context.playerId)
      }

    }
  },
  events: {
    playerJoined: (id, context) => {
    },
    playerLeft: (id, context) => {
      context.game.players = context.game.players.filter((p) => p.playerId !== id)
    },
  },
})
