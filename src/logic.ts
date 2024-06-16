import type { RuneClient } from "rune-games-sdk/multiplayer"

export const VIEW_HEIGHT = 800 * 2;
export const VIEW_WIDTH = 500 * 2;
export const MOVE_SPEED = 10;

export type Controls = {
  x: number;
  y: number;
  fire: boolean;
}

export type Rock = {
  x: number;
  y: number;
  vy: number;
  r: number;
}

export type Player = {
  health: number;
  x: number;
  y: number;
  index: number;
  id: string;
  controls: { x: number, y: number, fire: boolean }
}

export interface GameState {
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

Rune.initLogic({
  minPlayers: 2,
  maxPlayers: 2,
  setup: (allPlayerIds) => {
    const state: GameState = {
      players: [],
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
        controls: { x: 0, y: 0, fire: false }
      })
      index ++;
    }
    return state;
  },
  updatesPerSecond: 30,
  update: (context) => {
    for (const player of context.game.players) {
      player.x += player.controls.x * MOVE_SPEED;
      player.y += player.controls.y * MOVE_SPEED;

      player.x = Math.min(Math.max(0, player.x), VIEW_WIDTH);
      player.y = Math.min(Math.max(0, player.y), VIEW_HEIGHT);
    }

    if (Rune.gameTime() - context.game.lastRock > 2000) {
      context.game.rocks.push({
        x: Math.random() * VIEW_WIDTH,
        y: 0,
        r: Math.random() * Math.PI * 2,
        vy: (Math.random() * 5) + 2
      })
      context.game.lastRock = Rune.gameTime();
    }

    for (const rock of [...context.game.rocks]) {
      rock.y += rock.vy;
      if (rock.y > VIEW_HEIGHT + 100) {
        context.game.rocks.splice(context.game.rocks.indexOf(rock), 1);
      }
    }
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
