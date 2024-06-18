import type { RuneClient } from "rune-games-sdk/multiplayer"

export const VIEW_HEIGHT = 800 * 2;
export const VIEW_WIDTH = 500 * 2;
export const SPEED_SCALE = 2;
export const MOVE_SPEED = 10 * SPEED_SCALE;
export const FIRE_INTERVAL = 250;

export type Controls = {
  x: number;
  y: number;
  fire: boolean;
}

export type Collideable = {
  x: number;
  y: number;
  radius: number;
}

export type Bullet = {
  x: number;
  y: number;
  vy: number;
  radius: number;
  ownerIndex: number;
  type: "PLAYER" | "ENEMY";
}

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "ROCK";
}

export type Rock = {
  x: number;
  y: number;
  vy: number;
  r: number;
  radius: number;
}

export type Player = {
  health: number;
  x: number;
  y: number;
  index: number;
  id: string;
  controls: { x: number, y: number, fire: boolean },
  lastFire: number;
  radius: number;
}

export interface GameState {
  particles: Particle[];
  bullets: Bullet[];
  players: Player[];
  lastRock: number;
  rocks: Rock[];
}

export type GameActions = {
  controls: (params: {x: number, y: number, fire: boolean}) => void
}

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

function collide(a: Collideable, b: Collideable): boolean {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const rad = a.radius + b.radius;

  return ((dx*dx)+(dy*dy)) < (rad*rad);
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 1,
  setup: (allPlayerIds) => {
    const state: GameState = {
      particles: [],
      players: [],
      bullets: [],
      rocks: [],
      lastRock: -2000,
    }

    let index = 0;
    for (const id of allPlayerIds) {
      state.players.push({
        id,
        x: 200 + (index * 125),
        y: VIEW_HEIGHT - 400,
        index,
        health: 100,
        controls: { x: 0, y: 0, fire: false },
        lastFire: 0,
        radius: 20
      })
      index ++;
    }
    return state;
  },
  updatesPerSecond: 15,
  update: (context) => {
    // const game: GameState = JSON.parse(JSON.stringify(context.game));
    const game = context.game;

    for (const player of game.players) {
      player.x += player.controls.x * MOVE_SPEED;
      player.y += player.controls.y * MOVE_SPEED;

      player.x = Math.min(Math.max(0, player.x), VIEW_WIDTH);
      player.y = Math.min(Math.max(0, player.y), VIEW_HEIGHT);

      if (player.controls.fire && Rune.gameTime() - player.lastFire > FIRE_INTERVAL) {
        game.bullets.push({
          x: player.x, 
          y: player.y,
          radius: 5,
          vy: -20 * SPEED_SCALE,
          ownerIndex: player.index,
          type: "PLAYER"
        })
        player.lastFire = Rune.gameTime();
      }
    }

    if (Rune.gameTime() - game.lastRock > 5000) {
      game.rocks.push({
        x: Math.random() * VIEW_WIDTH,
        y: 0,
        r: Math.random() * Math.PI * 2,
        vy: ((Math.random() * 5) + 2) * SPEED_SCALE,
        radius: 30
      })
      game.lastRock = Rune.gameTime();
    }

    for (const particle of [...game.particles]) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      if (particle.x < 0 || particle.x > VIEW_WIDTH || particle.y < 0 || particle.y > VIEW_HEIGHT) {
        game.particles.splice(game.particles.indexOf(particle), 1);
      }
    }

    for (const bullet of [...game.bullets]) {
      bullet.y += bullet.vy;  
      if (bullet.y < - 50) {
        game.bullets.splice(game.bullets.indexOf(bullet), 1);
      }
    }

    for (const rock of [...game.rocks]) {
      rock.y += rock.vy;
      if (rock.y > VIEW_HEIGHT + 100) {
        game.rocks.splice(game.rocks.indexOf(rock), 1);
      }

      for (const bullet of game.bullets.filter(b => b.type === "PLAYER")) {
        if (collide(bullet, rock)) {
          // remove rock and bullet
          game.rocks.splice(game.rocks.indexOf(rock), 1);
          game.bullets.splice(game.bullets.indexOf(bullet), 1);
          // add particles
          const speed = 20;
          game.particles.push({ x: rock.x, y: rock.y, vx: -speed, vy: -speed, type: "ROCK" });
          game.particles.push({ x: rock.x, y: rock.y, vx: speed, vy: -speed, type: "ROCK" });
          game.particles.push({ x: rock.x, y: rock.y, vx: -speed, vy: speed, type: "ROCK" });
          game.particles.push({ x: rock.x, y: rock.y, vx: speed, vy: speed, type: "ROCK" });
        }
      }
    }
    
    // Object.assign(context.game, game);
  },
  actions: {
    controls: ({ x, y, fire }, context) => {
      const player = context.game.players.find(p => p.id === context.playerId);
      if (player) {
        player.controls.x = x;
        player.controls.y = y;
        player.controls.fire = fire;
      }
    }
  },
})
