import { graphics } from "toglib";
import { ASSETS } from "./lib/assets";
import { OnChangeParams } from "rune-games-sdk";
import { Controls, GameActions, GameState, VIEW_HEIGHT, VIEW_WIDTH } from "./logic";
import nipplejs, { JoystickManager } from "nipplejs";

const playerCols = ["blue", "green", "orange", "red"];
const DEAD_ZONE = 0.25;
const TARGET_FPS = 40;

function mulberry32(a: number) {
  return function() {
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

  stars: Star[] = [];

  fps: number = 0;
  frameCount: number = 0;
  lastFrameCountTime: number = 0;
  lastRender: number = 0;

  localRand: () => number = mulberry32(12345);

  constructor() {
    graphics.init(graphics.RendererType.WEBGL, false, undefined, 5);

    this.font = graphics.generateFont(16, "white");

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

    for (let i=0;i<1000;i++) {
      this.addStar();
      this.updateStars(4);
    }  

    for (const col of playerCols) {
      this.playerBullets.push(graphics.loadImage(ASSETS["laser_" + col + ".png"]));
      this.playerShips.push(graphics.loadImage(ASSETS["playerShip1_" + col + ".png"]));
    }
    this.rock = graphics.loadImage(ASSETS["meteorBrown_big1.png"]);
    this.rockParticle = graphics.loadImage(ASSETS["meteorBrown_tiny1.png"]);
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
        if (this.stick.y> DEAD_ZONE) {
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

  gameUpdate(update: OnChangeParams<GameState, GameActions>): void {
    this.currentGame = update.game;
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

  render(): void {
    if (performance.now() - this.lastRender < 1000 / TARGET_FPS) {
      return;
    }

    this.lastRender = performance.now();
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
          graphics.translate(particle.x, particle.y);
          graphics.drawImage(this.rockParticle, -(this.rockParticle.width / 2), -(this.rockParticle.height / 2));
          graphics.pop();
        }
      }
      for (const rock of this.currentGame.rocks) {
        graphics.push();
        graphics.rotate(rock.r + (rock.y * 0.01));
        graphics.translate(rock.x, rock.y);
        graphics.drawImage(this.rock, -(this.rock.width / 2), -(this.rock.height / 2));
        graphics.pop();
      }
      for (const bullet of this.currentGame.bullets) {
        graphics.drawImage(this.playerBullets[bullet.ownerIndex], bullet.x - (this.playerBullets[0].width / 2), bullet.y - (this.playerBullets[0].height / 2));
      }
      for (const player of this.currentGame.players) {
        graphics.drawImage(this.playerShips[player.index], player.x - (this.playerShips[0].width / 2), player.y - (this.playerShips[0].height / 2));
      }
    }
    graphics.pop();

    if (this.currentGame) {
      graphics.drawText(0, 20, this.fps+"   "+Rune.gameTime()+" " + this.stars.length+" " +this.currentGame.rocks.length +" "+this.currentGame.particles.length, this.font);
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