import { graphics } from "toglib";
import { ASSETS } from "./lib/assets";
import { Interpolator, OnChangeParams } from "rune-games-sdk";
import { BULLET_SPEED, Controls, GameActions, GameElement, GameState, MOVE_SPEED, PARTICLE_SPEED, ROCK_MAX_SPEED, VIEW_HEIGHT, VIEW_WIDTH } from "./logic";
import nipplejs, { JoystickManager } from "nipplejs";

const playerCols = ["blue", "green", "orange", "red"];
const DEAD_ZONE = 0.25;
const TARGET_FPS = 40;

function mulberry32(a: number) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

type Star = {
  x: number,
  y: number
}

export class PewPew implements graphics.Game {
  cols: string[] = ["#36bbf5", "#6fc834", "#ca4b26", "#ac3939"];
  tinyShips: graphics.GameImage[] = [];
  playerShips: graphics.GameImage[] = [];
  playerBullets: graphics.GameImage[] = [];
  stick: { x: number, y: number } = { x: 0, y: 0 };
  keys: Record<string, boolean> = {};
  currentGame?: GameState;
  lastSentControls: Controls = { x: 0, y: 0, fire: false };
  fire: boolean = false;
  lastSentControlsTime: number = 0;
  font: graphics.GameFont;
  rock: graphics.GameImage;
  rockParticle: graphics.GameImage;
  logo: graphics.GameImage;

  stars: Star[] = [];

  fps: number = 0;
  frameCount: number = 0;
  lastFrameCountTime: number = 0;
  lastRender: number = 0;
  ang: number = 0;

  localRand: () => number = mulberry32(12345);
  interpolators: Record<number, Interpolator<number[]>> = {};
  localPlayerId: string = "";

  constructor() {
    graphics.init(graphics.RendererType.WEBGL, false, undefined, 5);

    this.font = graphics.generateFont(20, "white");

    const joystick: JoystickManager = nipplejs.create({
      mode: "static",
      zone: document.getElementById("joystick") ?? document.body,
      position: { left: '25%', bottom: '35%' },
      threshold: 0.2,
    });

    joystick.on("move", (event, joystick) => {
      this.stick = joystick.vector;
      this.updateControls();
    });
    joystick.on("end", () => {
      this.stick = { x: 0, y: 0 };
      this.updateControls();
    });
    document.getElementById("fire")!.addEventListener("touchstart", () => {
      document.getElementById("fire")!.style.opacity = "1";
      this.fire = true;
      this.updateControls(true);
    })
    document.getElementById("fire")!.addEventListener("touchend", () => {
      document.getElementById("fire")!.style.opacity = "0.5";
      this.fire = false;
      this.updateControls();
    })

    setInterval(() => {
      this.updateControls();
    }, 150);
    setInterval(() => {
      this.addStar();
    }, 250);

    for (let i = 0; i < 1000; i++) {
      this.addStar();
      this.updateStars(4);
    }

    for (const col of playerCols) {
      this.playerBullets.push(graphics.loadImage(ASSETS["laser_" + col + ".png"]));
      this.playerShips.push(graphics.loadImage(ASSETS["playerShip1_" + col + ".png"]));
      this.tinyShips.push(graphics.loadImage(ASSETS["playerLife1_" + col + ".png"]));
    }
    this.rock = graphics.loadImage(ASSETS["meteorBrown_big1.png"]);
    this.rockParticle = graphics.loadImage(ASSETS["meteorBrown_tiny1.png"]);
    this.logo = graphics.loadImage(ASSETS["logo.png"]);
  }

  addStar() {
    this.stars.push({
      x: this.localRand() * VIEW_WIDTH,
      y: 0
    })
  }

  updateStars(delta: number) {
    for (const star of this.stars) {
      star.y += 20 * delta;
    }
    this.stars = this.stars.filter(s => s.y < VIEW_HEIGHT);
  }

  updateControls(force: boolean = false): void {
    if (this.currentGame) {
      const sinceLastControls = Date.now() - this.lastSentControlsTime;
      if (sinceLastControls > 100 || force) {
        let x = 0;
        let y = 0;
        if (this.keys['d']) {
          x = 1;
        }
        if (this.keys['a']) {
          x = -1;
        }
        if (this.keys['w']) {
          y = -1;
        }
        if (this.keys['s']) {
          y = 1;
        }
        if (this.stick.x > DEAD_ZONE) {
          x = 1;
        }
        if (this.stick.x < -DEAD_ZONE) {
          x = -1;
        }
        if (this.stick.y > DEAD_ZONE) {
          y = -1;
        }
        if (this.stick.y < -DEAD_ZONE) {
          y = 1;
        }
        if (this.lastSentControls.x !== x || this.lastSentControls.y !== y || this.lastSentControls.fire !== this.fire) {
          Rune.actions.controls({ x, y, fire: this.fire });
          this.lastSentControlsTime = Date.now();
          this.lastSentControls.x = x;
          this.lastSentControls.y = y;
          this.lastSentControls.fire = this.fire;
        }
      }
    }
  }

  mouseDown(): void {
    if (!this.inGame()) {
      Rune.actions.join();
    }
  }

  mouseDrag(): void {
  }

  mouseUp(): void {
    this.updateControls();
  }

  keyDown(key: string): void {
    this.keys[key] = true;
    if (key === ' ') {
      this.fire = true;
      this.updateControls(true);
    } else {
      this.updateControls();
    }
  }

  keyUp(key: string): void {
    this.keys[key] = false;
    if (key === ' ') {
      this.fire = false;
    }
    this.updateControls();
  }

  getElementLocation(element: GameElement): { x: number, y: number } {
    const lerp = this.interpolators[element.id];
    if (lerp) {
      const pos = lerp.getPosition();
      return { x: pos[0], y: pos[1] };
    }
    return { x: element.x, y: element.y };
  }

  isLocalPlayer(game: GameElement): boolean {
    return (game as any).playerId === this.localPlayerId;
  }

  updateInterpolators(game: GameElement[], futureGame: GameElement[], maxSpeed: number): void {
    for (const element of game) {
      if (!this.interpolators[element.id]) {
        this.interpolators[element.id] = this.isLocalPlayer(element) ? Rune.interpolator<number[]>() : Rune.interpolatorLatency<number[]>({ maxSpeed });
        this.interpolators[element.id].update({ game: [element.x, element.y], futureGame: [element.x, element.y] })
      }
      const futureElement = futureGame.find(e => e.id === element.id);
      if (futureElement) {
        this.interpolators[element.id].update({ game: [element.x, element.y], futureGame: [futureElement.x, futureElement.y] })
      }
    }
  }

  gameUpdate(update: OnChangeParams<GameState, GameActions>): void {
    this.currentGame = update.game;
    if (update.yourPlayerId) {
      this.localPlayerId = update.yourPlayerId;
    }

    if (update.futureGame) {
      this.updateInterpolators(update.game.rocks, update.futureGame.rocks, ROCK_MAX_SPEED);
      this.updateInterpolators(update.game.bullets, update.futureGame.bullets, BULLET_SPEED);
      this.updateInterpolators(update.game.particles, update.futureGame.particles, PARTICLE_SPEED);
      this.updateInterpolators(update.game.players, update.futureGame.players, MOVE_SPEED);
    }

    const elements = [...update.game.rocks, ...update.game.bullets, ...update.game.particles, ...update.game.players];
    const keyedElements: Record<number, GameElement> = {};
    elements.forEach(e => keyedElements[e.id] = e);

    for (const idString of Object.keys(this.interpolators)) {
      const id = idString as any as number;
      if (!keyedElements[id]) {
        delete this.interpolators[id];
      }
    }
  }

  resourcesLoaded(): void {
    // initialise the Rune SDK and register the callback to get
    // game updates
    Rune.initClient({
      onChange: (update) => {
        this.gameUpdate(update);
      },
    });
  }

  inGame(): boolean {
    if (this.currentGame) {
      return this.currentGame.players.find(p => p.playerId === this.localPlayerId) != undefined;
    }

    return false;
  }

  render(): void {
    if (Date.now() - this.lastRender < 1000 / TARGET_FPS) {
      return;
    }

    this.lastRender = Date.now();
    this.frameCount++;
    if (Date.now() - this.lastFrameCountTime > 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameCountTime = Date.now();
    }
    if (this.fps > 0) {
      this.updateStars(30 / this.fps);
    }

    const scaleh = graphics.height() / VIEW_HEIGHT;
    const scalew = graphics.width() / VIEW_WIDTH;
    graphics.push();
    graphics.scale(scalew, scaleh);

    if (this.currentGame) {
      for (const star of this.stars) {
        graphics.fillRect(star.x, star.y, 4, 4, "white");
      }
      for (const particle of this.currentGame.particles) {
        if (particle.type === "ROCK") {
          graphics.push();
          graphics.rotate((particle.y * 0.01));
          const location = this.getElementLocation(particle);
          graphics.translate(location.x, location.y);
          graphics.drawImage(this.rockParticle, -(this.rockParticle.width / 2), -(this.rockParticle.height / 2));
          graphics.pop();
        }
      }
      for (const rock of this.currentGame.rocks) {
        graphics.push();
        graphics.rotate(rock.r + (rock.y * 0.01));
        const location = this.getElementLocation(rock);
        graphics.translate(location.x, location.y);
        graphics.drawImage(this.rock, -(this.rock.width / 2), -(this.rock.height / 2));
        graphics.pop();
      }
      for (const bullet of this.currentGame.bullets) {
        const location = this.getElementLocation(bullet);
        graphics.drawImage(this.playerBullets[bullet.ownerIndex], location.x - (this.playerBullets[0].width / 2), location.y - (this.playerBullets[0].height / 2));
      }
      for (const player of this.currentGame.players) {
        const location = this.getElementLocation(player);
        graphics.drawImage(this.playerShips[player.index], location.x - (this.playerShips[0].width / 2), location.y - (this.playerShips[0].height / 2));
      }
    }
    graphics.pop();

    this.ang += 0.1;

    if (this.currentGame) {
      if (!this.inGame()) {
        const h = (this.logo.height / this.logo.width) * graphics.width();
        graphics.drawImage(this.logo, 0, 0, graphics.width(), h);
        const col = "#46faee";
        let msg = "";

        if (this.currentGame.players.length === 0) {
          msg = "Tap to Start The Battle";
        } else {
          msg = "Tap to Join The Battle";
        }
        graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.font)) / 2), 250 + (Math.sin(this.ang) * 20), msg, this.font, col);
      } else {
        // HUD
        const localPlayer = this.currentGame.players.find(p => p.playerId === this.localPlayerId);
        if (localPlayer) {
          graphics.drawImage(this.tinyShips[localPlayer.index], 0, 0);
          for (let i = 0; i < localPlayer.health; i++) {
            graphics.fillRect(35 + (i * 20), 2, 18, 10, this.cols[localPlayer.index])
          }

          let index = 0;
          for (const p of this.currentGame.players) {
            if (p === localPlayer) {
              continue;
            }
            graphics.drawImage(this.tinyShips[p.index], graphics.width() - 17, index * 15, 17, 13);
            for (let i = 0; i < p.health; i++) {
              graphics.fillRect(graphics.width() - 29 - (i * 12), 4 + (index *15), 10, 6, this.cols[p.index])
            }
            index++;
          }
        }
      }
    }
  }

  zoomChanged?(): void {
  }

  start(): void {
    // kick off the TOGL rendering loop
    graphics.startRendering(this);
  }
}

const game = new PewPew();
game.start();