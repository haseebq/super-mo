import { Application, Graphics, Text, TextStyle, Sprite, Texture, Container, Rectangle } from "pixi.js";
import type { Renderer } from "./renderer.js";

export type PixiRenderer = Renderer & {
  app: Application;
  stage: Container;
  destroy: () => void;
};

export async function createPixiRenderer(canvas: HTMLCanvasElement): Promise<PixiRenderer> {
  const app = new Application();
  
  await app.init({
    canvas,
    width: canvas.width,
    height: canvas.height,
    backgroundColor: 0x000000,
    antialias: false,
    resolution: 1,
    autoDensity: true,
  });

  // Container for all game graphics - cleared each frame
  const gameContainer = new Container();
  app.stage.addChild(gameContainer);

  // Graphics object for primitives (rects, circles)
  const graphics = new Graphics();
  gameContainer.addChild(graphics);

  // Text style for simple text rendering
  const textStyle = new TextStyle({
    fontFamily: "Courier New",
    fontSize: 10,
    fill: 0xffffff,
  });

  // Cache for textures created from HTMLImageElements
  const textureCache = new Map<HTMLImageElement, Texture>();

  function getTexture(image: HTMLImageElement): Texture {
    let texture = textureCache.get(image);
    if (!texture) {
      texture = Texture.from(image);
      textureCache.set(image, texture);
    }
    return texture;
  }

  // Pool of sprite objects for reuse
  const spritePool: Sprite[] = [];
  let spriteIndex = 0;

  // Pool of text objects for reuse
  const textPool: Text[] = [];
  let textIndex = 0;

  function getSprite(): Sprite {
    if (spriteIndex < spritePool.length) {
      const sprite = spritePool[spriteIndex];
      sprite.visible = true;
      spriteIndex++;
      return sprite;
    }
    const sprite = new Sprite();
    spritePool.push(sprite);
    gameContainer.addChild(sprite);
    spriteIndex++;
    return sprite;
  }

  function getTextObject(): Text {
    if (textIndex < textPool.length) {
      const text = textPool[textIndex];
      text.visible = true;
      textIndex++;
      return text;
    }
    const text = new Text({ text: "", style: textStyle });
    textPool.push(text);
    gameContainer.addChild(text);
    textIndex++;
    return text;
  }

  function parseColor(color: string): number {
    if (color.startsWith("#")) {
      return parseInt(color.slice(1), 16);
    }
    if (color.startsWith("rgb")) {
      const match = color.match(/\d+/g);
      if (match && match.length >= 3) {
        const r = parseInt(match[0], 10);
        const g = parseInt(match[1], 10);
        const b = parseInt(match[2], 10);
        return (r << 16) | (g << 8) | b;
      }
    }
    return 0x000000;
  }

  // Fake 2D context for compatibility with code that accesses ctx directly
  const fakeCtx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    setTransform: () => {},
    fillStyle: "",
    strokeStyle: "",
    font: "",
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    drawImage: () => {},
  } as unknown as CanvasRenderingContext2D;

  const renderer: PixiRenderer = {
    app,
    stage: gameContainer,

    clear(color: string) {
      // Reset pools
      spriteIndex = 0;
      textIndex = 0;
      
      // Hide all pooled sprites and texts
      for (const sprite of spritePool) {
        sprite.visible = false;
      }
      for (const text of textPool) {
        text.visible = false;
      }
      
      // Clear graphics
      graphics.clear();
      
      // Set background color
      app.renderer.background.color = parseColor(color);
    },

    rect(x: number, y: number, w: number, h: number, color: string) {
      graphics.rect(Math.round(x), Math.round(y), w, h);
      graphics.fill(parseColor(color));
    },

    circle(x: number, y: number, r: number, color: string) {
      graphics.circle(x, y, r);
      graphics.fill(parseColor(color));
    },

    sprite(
      image: HTMLImageElement,
      sx: number,
      sy: number,
      sw: number,
      sh: number,
      dx: number,
      dy: number,
      dw: number = sw,
      dh: number = sh,
      flipX: boolean = false
    ) {
      const baseTexture = getTexture(image);
      const sprite = getSprite();
      
      // Create a texture from a region of the base texture
      const frame = new Rectangle(sx, sy, sw, sh);
      
      // Update sprite texture with the correct frame
      sprite.texture = new Texture({
        source: baseTexture.source,
        frame,
      });
      
      sprite.width = dw;
      sprite.height = dh;
      
      if (flipX) {
        sprite.scale.x = -Math.abs(sprite.scale.x);
        sprite.x = Math.round(dx) + dw;
      } else {
        sprite.scale.x = Math.abs(sprite.scale.x);
        sprite.x = Math.round(dx);
      }
      sprite.y = Math.round(dy);
    },

    text(content: string, x: number, y: number, color: string) {
      const textObj = getTextObject();
      textObj.text = content;
      textObj.x = x;
      textObj.y = y - 10; // Adjust for baseline difference
      textObj.style.fill = parseColor(color);
    },

    // Compatibility: provide a fake ctx for code that accesses it directly
    ctx: fakeCtx,

    destroy() {
      textureCache.clear();
      app.destroy(true);
    },
  };

  return renderer;
}
