import { graphics } from "toglib";
import { ASSETS } from "./lib/assets";
import { OnChangeParams } from "rune-games-sdk";
import { Controls, GameActions, GameState, VIEW_HEIGHT, VIEW_WIDTH } from "./logic";
import nipplejs, { JoystickManager } from "nipplejs";

const playerCols = ["blue", "green", "orange", "red"];
const DEAD_ZONE = 0.25;

export class PewPew implements graphics.Game {
  playerShips: graphics.GameImage[] = [];
  stick: { x: number, y: number } = { x: 0, y: 0 };
  keys: Record<string, boolean> = {};
  currentGame?: GameState;
  lastSentControls: Controls = { x: 0, y: 0, fire: false };
  fire: boolean = false;
  lastSentControlsTime: number = 0;
  font: graphics.GameFont;
  rock: graphics.GameImage;

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
      this.updateControls();
    })
    document.getElementById("fire")!.addEventListener("touchend", () => {
      document.getElementById("fire")!.style.opacity = "0.5";
      this.fire = false;
      this.updateControls();
    })

    setInterval(() => {
      this.updateControls();
    }, 125);

    for (const col of playerCols) {
      this.playerShips.push(graphics.loadImage(ASSETS["playerShip1_" + col + ".png"]));
    }
    this.rock = graphics.loadImage(ASSETS["meteorBrown_big1.png"]);
  }

  updateControls(): void {
    if (this.currentGame) {
      const sinceLastControls = Date.now() - this.lastSentControlsTime;
      if (sinceLastControls > 100) {
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
    this.updateControls();
  }

  keyUp(key: string): void {
    this.keys[key] = false;
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
    const scaleh = graphics.height() / VIEW_HEIGHT;
    const scalew = graphics.width() / VIEW_WIDTH;
    graphics.push();
    graphics.scale(scalew, scaleh);

    if (this.currentGame) {
      for (const rock of this.currentGame.rocks) {
        graphics.push();
        graphics.rotate(rock.r + (rock.y * 0.01));
        graphics.translate(rock.x, rock.y);
        graphics.drawImage(this.rock, -(this.rock.width / 2), -(this.rock.height / 2));
        graphics.pop();
      }
      for (const player of this.currentGame.players) {
        graphics.drawImage(this.playerShips[player.index], player.x - (this.playerShips[0].width / 2), player.y - (this.playerShips[0].height / 2));
      }
    }
    graphics.pop();

    if (this.currentGame) {
      graphics.drawText(0, 20, ""+Rune.gameTime(), this.font);
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