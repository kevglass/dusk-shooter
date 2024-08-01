import { graphics, sound } from "toglib";
import { ASSETS } from "./lib/assets";
import { Interpolator, OnChangeParams } from "dusk-games-sdk";
import { BULLET_SPEED, Controls, ENEMY_MOVE_SPEED, EnemyColor, EnemyColors as enemyColors, GameActions, GameElement, GameState, getPhase, MOVE_SPEED, PARTICLE_SPEED, ParticleType, Persisted, POWER_UP_DRIFT_SPEED, PowerUpType, ROCK_MAX_SPEED, VIEW_HEIGHT, VIEW_WIDTH } from "./logic";
import nipplejs, { JoystickManager } from "nipplejs";

const playerCols = ["blue", "green", "orange", "red"];
const DEAD_ZONE = 0.25;
const TARGET_FPS = 60;

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
  y: number,
  vy: number
}

const touchDevice = ('ontouchstart' in document.documentElement);

export class PewPew implements graphics.Game {
  cols: string[] = ["#36bbf5", "#6fc834", "#ca4b26", "#ac3939"];
  tinyShips: graphics.GameImage[] = [];
  playerShips: graphics.GameImage[] = [];
  enemyShips: Record<EnemyColor, graphics.GameImage[]>;
  playerBullets: graphics.GameImage[] = [];
  stick: { x: number, y: number } = { x: 0, y: 0 };
  keys: Record<string, boolean> = {};
  currentGame?: GameState;
  lastSentControls: Controls = { x: 0, y: 0, fire: false };
  fire: boolean = false;
  lastSentControlsTime: number = 0;
  font: graphics.GameFont;
  scoreFont: graphics.GameFont;
  bigFont: graphics.GameFont;
  rock: graphics.GameImage;
  rockParticle: graphics.GameImage;
  star1Particle: graphics.GameImage;
  star2Particle: graphics.GameImage;
  star3Particle: graphics.GameImage;
  enemyBullet: graphics.GameImage;
  logo: graphics.GameImage;
  fireSound: sound.Sound;
  explodeSound: sound.Sound;
  dieSound: sound.Sound;
  hitSound: sound.Sound;
  collectSound: sound.Sound;
  music: sound.Sound;
  musicStarted: boolean = false;
  powerUpImages: Record<PowerUpType, graphics.GameImage>;

  particleImages: Record<ParticleType, graphics.GameImage>;

  stars: Star[] = [];

  fps: number = 0;
  frameCount: number = 0;
  lastFrameCountTime: number = 0;
  lastRender: number = 0;

  localRand: () => number = mulberry32(12345);
  interpolators: Record<number, Interpolator<number[]>> = {};
  interpolatorAngles: Record<number, number> = {};

  localPlayerId: string = "";

  constructor() {
    graphics.init(graphics.RendererType.WEBGL, false, undefined, 5);

    this.bigFont = graphics.generateFont(30, "white");
    this.font = graphics.generateFont(16, "white");
    this.scoreFont = graphics.generateFont(16, "white");

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

    if (!touchDevice) {
      (document.getElementById("fire") as HTMLImageElement).addEventListener("mousedown", () => {
        this.fire = true;
        if (!this.inGame()) {
          Dusk.actions.join();
        }
        this.updateControls(true);
      })

      document.getElementById("fire")!.addEventListener("mouseup", () => {
        this.fire = false;
        this.updateControls();
      });
    } else {

      (document.getElementById("fire") as HTMLImageElement).addEventListener("touchstart", () => {
        this.fire = true;
        if (!this.inGame()) {
          Dusk.actions.join();
        }
        this.updateControls(true);
      })
      document.getElementById("fire")!.addEventListener("touchend", () => {
        this.fire = false;
        this.updateControls();
      })
    }

    setInterval(() => {
      this.updateControls();
    }, 150);
    setInterval(() => {
      this.addStar();
    }, 250);

    for (const col of playerCols) {
      this.playerBullets.push(graphics.loadImage(ASSETS["laser_" + col + ".png"]));
      this.playerShips.push(graphics.loadImage(ASSETS["playerShip1_" + col + ".png"]));
      this.tinyShips.push(graphics.loadImage(ASSETS["playerLife1_" + col + ".png"]));
    }

    this.enemyShips = {
      Black: [],
      Blue: [],
      Green: [],
      Red: [],
    }
    for (const col of enemyColors) {
      for (let index = 0; index < 5; index++) {
        this.enemyShips[col][index] = graphics.loadImage(ASSETS["enemies/enemy" + col + "" + (index + 1) + ".png"])
      }
    }
    this.rock = graphics.loadImage(ASSETS["meteorBrown_big1.png"]);
    this.rockParticle = graphics.loadImage(ASSETS["meteorBrown_tiny1.png"]);
    this.star1Particle = graphics.loadImage(ASSETS["star1.png"]);
    this.star2Particle = graphics.loadImage(ASSETS["star2.png"]);
    this.star3Particle = graphics.loadImage(ASSETS["star3.png"]);
    this.enemyBullet = graphics.loadImage(ASSETS["enemyBullet.png"]);
    this.logo = graphics.loadImage(ASSETS["logo.png"]);
    this.fireSound = sound.loadSound(ASSETS["lazer.mp3"]);
    this.explodeSound = sound.loadSound(ASSETS["explode.mp3"]);
    this.hitSound = sound.loadSound(ASSETS["hit.mp3"]);
    this.dieSound = sound.loadSound(ASSETS["die.mp3"]);
    this.music = sound.loadSound(ASSETS["music.mp3"]);
    this.collectSound = sound.loadSound(ASSETS["pickup.mp3"]);

    this.particleImages = {
      ROCK: this.rockParticle,
      STAR1: this.star1Particle,
      STAR2: this.star2Particle,
      STAR3: this.star3Particle,
    }

    this.powerUpImages = {
      SPEED: graphics.loadImage(ASSETS["powerupGreen_speed.png"]),
      DOUBLE_SHOT: graphics.loadImage(ASSETS["powerupGreen_bolt.png"]),
      SHIELD: graphics.loadImage(ASSETS["powerupGreen_shield.png"]),
      HEALTH: graphics.loadImage(ASSETS["powerupGreen_heart.png"]),
      FAST_FIRE: graphics.loadImage(ASSETS["powerupGreen_star.png"]),
    }
  }

  addStar() {
    this.stars.push({
      x: this.localRand() * VIEW_WIDTH,
      y: 0,
      vy: this.localRand() > 0.5 ? 0.5 : 1
    })
  }

  updateStars(delta: number) {
    for (const star of this.stars) {
      star.y += 20 * delta * star.vy;
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
          Dusk.actions.controls({ x, y, fire: this.fire });
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
      Dusk.actions.join();
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
      return { x: Math.floor(pos[0]), y: Math.floor(pos[1]) };
    }

    return { x: Math.floor(element.x), y: Math.floor(element.y) };
  }

  isLocalPlayer(game: GameElement): boolean {
    return (game as unknown as { playerId: string }).playerId === this.localPlayerId;
  }

  updateInterpolators(game: GameElement[], futureGame: GameElement[], maxSpeed: number, allowLatency: boolean = false): void {
    for (const element of game) {
      if (!this.interpolators[element.id]) {
        if (!this.isLocalPlayer(element) && allowLatency) {
          const latency = Dusk.interpolatorLatency<number[]>({ maxSpeed: maxSpeed, timeToMaxSpeed: 50 });
          this.interpolators[element.id] = latency
          this.interpolators[element.id].update({ game: [element.x, element.y], futureGame: [element.x, element.y] })
        } else if (!this.isLocalPlayer(element)) {
          this.interpolators[element.id] = Dusk.interpolator<number[]>();
          this.interpolators[element.id].update({ game: [element.x, element.y], futureGame: [element.x, element.y] })
        } else {
          continue;
        }
      }
      const futureElement = futureGame.find(e => e.id === element.id);
      if (futureElement) {
        const dy = futureElement.y - element.y;
        const dx = futureElement.x - element.x;
        if (dx === 0 && dy === 0) {
          this.interpolatorAngles[element.id] = Math.PI / 2;
        } else {
          this.interpolatorAngles[element.id] = Math.atan2(dy, dx)
        }

        this.interpolators[element.id].update({ game: [element.x, element.y], futureGame: [futureElement.x, futureElement.y] })
      }
    }
  }

  gameUpdate(update: OnChangeParams<GameState, GameActions, Persisted>): void {
    this.currentGame = update.game;
    if (update.yourPlayerId) {
      this.localPlayerId = update.yourPlayerId;
    }

    for (const event of this.currentGame.events) {
      if (event.type === "FIRE" && event.who === this.localPlayerId) {
        sound.playSound(this.fireSound);
      }
      if (event.type === "EXPLODE") {
        sound.playSound(this.explodeSound);
      }
      if (event.type === "HIT" && event.who === this.localPlayerId) {
        sound.playSound(this.hitSound);
      }
      if (event.type === "DIE" && event.who === this.localPlayerId) {
        sound.playSound(this.dieSound);
      }
      if (event.type === "COLLECT" && event.who === this.localPlayerId) {
        sound.playSound(this.collectSound);
      }
    }

    if (update.futureGame && (update.event?.name === "update" || update.event?.name === "stateSync")) {
      this.updateInterpolators(update.game.rocks, update.futureGame.rocks, ROCK_MAX_SPEED);
      this.updateInterpolators(update.game.bullets, update.futureGame.bullets, BULLET_SPEED);
      this.updateInterpolators(update.game.particles, update.futureGame.particles, PARTICLE_SPEED);
      this.updateInterpolators(update.game.players, update.futureGame.players, MOVE_SPEED, true);
      this.updateInterpolators(update.game.enemies, update.futureGame.enemies, ENEMY_MOVE_SPEED * getPhase(update.game).speedModifier);
      this.updateInterpolators(update.game.powerUps, update.futureGame.powerUps, POWER_UP_DRIFT_SPEED);
    }

    const elements = [...update.game.rocks, ...update.game.bullets, ...update.game.particles, ...update.game.players, ...update.game.enemies, ...update.game.powerUps];
    const keyedElements: Record<number, GameElement> = {};
    elements.forEach(e => keyedElements[e.id] = e);

    for (const idString of Object.keys(this.interpolators)) {
      const id = (idString as unknown) as number;
      if (!keyedElements[id]) {
        delete this.interpolators[id];
        delete this.interpolatorAngles[id];
      }
    }
  }

  resourcesLoaded(): void {
    // initialise the Rune SDK and register the callback to get
    // game updates
    Dusk.initClient({
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
      if (!this.musicStarted && this.music.buffer) {
        this.musicStarted = true;
        sound.loopSound(this.music, 0.25);
      }

      for (const star of this.stars) {
        graphics.drawImage(this.star1Particle, star.x, star.y, this.star1Particle.width, this.star1Particle.height, star.vy === 1 ? "white" : "blue")
      }
      for (const particle of this.currentGame.particles) {
        const image = this.particleImages[particle.type];
        graphics.push();
        graphics.rotate((particle.y * 0.01));
        const location = this.getElementLocation(particle);
        graphics.translate(location.x, location.y);
        graphics.drawImage(image, -(image.width / 2), -(image.height / 2));
        graphics.pop();
      }
      for (const rock of this.currentGame.rocks) {
        graphics.push();
        graphics.rotate(rock.r + (rock.y * 0.01));
        const location = this.getElementLocation(rock);
        graphics.translate(location.x, location.y);
        graphics.drawImage(this.rock, -(this.rock.width / 2), -(this.rock.height / 2));
        graphics.pop();
      }
      for (const enemy of this.currentGame.enemies) {
        const location = this.getElementLocation(enemy);
        const lastHit = Dusk.gameTime() - enemy.lastHit;
        const image = this.enemyShips[enemy.col][enemy.index];
        graphics.push();
        graphics.rotate((this.interpolatorAngles[enemy.id] ?? 0) - (Math.PI / 2));
        graphics.translate(location.x, location.y);
        if (lastHit < 150) {
          graphics.drawImage(image, -(image.width / 2), - (image.height / 2), image.width, image.height, "red");
        } else {
          graphics.drawImage(image, -(image.width / 2), - (image.height / 2));
        }
        graphics.pop();
      }
      for (const bullet of this.currentGame.bullets) {
        const location = this.getElementLocation(bullet);
        const image = bullet.type === "PLAYER" ? this.playerBullets[bullet.ownerIndex % this.playerBullets.length] : this.enemyBullet;
        graphics.drawImage(image, location.x - (image.width / 2), location.y - (image.height / 2));
      }
      for (const powerUp of this.currentGame.powerUps) {
        const location = this.getElementLocation(powerUp);
        const image = this.powerUpImages[powerUp.type];
        graphics.drawImage(image, location.x - (image.width), location.y - (image.height), image.width * 2, image.height * 2);
      }
      for (const player of this.currentGame.players) {
        const location = this.getElementLocation(player);
        const lastHit = Dusk.gameTime() - player.lastHit;
        const image = this.playerShips[player.index % this.playerShips.length];
        if (lastHit < 3000 && Math.floor(lastHit / 200) % 2 == 0) {
          graphics.drawImage(image, location.x - (image.width / 2), location.y - (image.height / 2), image.width, image.height, "red");
        } else {
          graphics.drawImage(image, location.x - (image.width / 2), location.y - (image.height / 2));
        }
      }
    }
    graphics.pop();

    if (this.currentGame) {
      if (!this.inGame()) {
        const h = (this.logo.height / this.logo.width) * graphics.width();
        graphics.drawImage(this.logo, 0, 0, graphics.width(), h);
        const col = "#46faee";
        let msg = "";

        if (this.currentGame.players.length === 0) {
          msg = "Tap to Start The Battle".toUpperCase();
        } else {
          msg = "Tap to Join The Battle".toUpperCase();
        }
        graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.font)) / 2), 300 + (Math.sin(Date.now() * 0.005) * 20), msg, this.font, col);

        const bestRun = this.currentGame.persisted?.[this.localPlayerId];
        if (bestRun) {
          if (bestRun.bestPhase) {
            msg = "BEST RUN";
            graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.font)) / 2), 380, msg, this.font, col);
            msg = "PHASE " + (bestRun.bestPhase + "").padStart(3, "0") + "         " + (bestRun.bestScore + "").padStart(10, "0");
            graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.font)) / 2), 400, msg, this.font);
          }
        }
      } else {
        if (Dusk.gameTime() < this.currentGame.phaseStart) {
          let msg = "Phase " + this.currentGame.phase;
          graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(msg, this.bigFont)) / 2), 300, msg, this.bigFont);
          msg = this.currentGame.phaseInfo.msg;
          const col = "#46faee";
          const words = msg.toUpperCase().split(" ");
          let line = "";
          const width = 250;
          let y = 340;
          for (let i = 0; i < words.length; i++) {
            if (graphics.textWidth(line + " " + words[i], this.font) > width) {
              graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(line, this.font)) / 2), y, line, this.font, col);
              line = words[i];
              y += 17;
            } else {
              line += " " + words[i];
            }
          }
          graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(line, this.font)) / 2), y, line, this.font, col);

        }
        // HUD
        const localPlayer = this.currentGame.players.find(p => p.playerId === this.localPlayerId);
        if (localPlayer) {
          graphics.drawImage(this.tinyShips[localPlayer.index % this.tinyShips.length], 0, 0);
          for (let i = 0; i < localPlayer.maxHealth; i++) {
            graphics.fillRect(35 + (i * 20), 2, 18, 10, "white")
            graphics.fillRect(35 + (i * 20) + 1, 3, 16, 8, "black")
            if (i < localPlayer.health) {
              graphics.fillRect(35 + (i * 20) + 1, 3, 16, 8, this.cols[localPlayer.index % this.cols.length])
            }
          }
          graphics.fillRect(35, 14, localPlayer.gunTemp * 60, 5, localPlayer.gunTemp >= 0.9 ? "red" : "orange");

          const score = ("" + localPlayer.score).padStart(10, "0");
          graphics.drawText(Math.floor((graphics.width() - graphics.textWidth(score, this.scoreFont)) / 2), 30, score, this.scoreFont);

          let index = 0;
          for (const p of this.currentGame.players) {
            if (p === localPlayer) {
              continue;
            }
            graphics.drawImage(this.tinyShips[p.index % this.tinyShips.length], graphics.width() - 17, index * 15, 17, 13);
            for (let i = 0; i < p.health; i++) {
              graphics.fillRect(graphics.width() - 29 - (i * 12), 4 + (index * 15), 10, 6, this.cols[p.index % this.cols.length])
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