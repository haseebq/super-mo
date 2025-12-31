import { Application, Graphics, Text, TextStyle, Sprite, Texture, Container, Rectangle } from "pixi.js";
import type { Renderer } from "./renderer.js";

export type PixiRenderer = Renderer & {
  app: Application;
  stage: Container;
  destroy: () => void;
  render: () => void; // Call this at end of frame to present
  resize: () => void; // Call to resize to match CSS display size
};

/**
 * Create a Pixi.js-based renderer that implements the same interface as the Canvas 2D renderer.
 * 
 * This is a hybrid approach: Pixi manages the WebGL context and rendering,
 * but we also maintain a Canvas 2D context for operations that require
 * immediate-mode drawing with transforms (save/restore/translate).
 * 
 * The game's architecture uses immediate-mode rendering with ctx transforms,
 * so we layer a 2D canvas on top of Pixi's canvas for transform operations.
 */
export async function createPixiRenderer(canvas: HTMLCanvasElement): Promise<PixiRenderer> {
  const app = new Application();
  
  // Game's native resolution
  const GAME_WIDTH = 320;
  const GAME_HEIGHT = 180;
  
  // Initialize Pixi with the game's native resolution
  // CSS will handle visual scaling via image-rendering: pixelated
  await app.init({
    canvas,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: 0x78c7f0, // Match the sky blue background
    antialias: false,
    resolution: 1, // Keep 1:1 pixel ratio, CSS handles scaling
    autoDensity: false, // Don't auto-adjust for device pixel ratio
    autoStart: false, // Don't start Pixi's own render loop - we manage our own
  });
  
  // Root container - no scaling needed, CSS handles it
  const rootContainer = new Container();
  app.stage.addChild(rootContainer);

  // Container for camera transforms (child of root for proper scaling)
  const cameraContainer = new Container();
  rootContainer.addChild(cameraContainer);

  // Graphics object for primitives (rects, circles) - reset each frame
  let graphics = new Graphics();
  cameraContainer.addChild(graphics);

  // Text style for simple text rendering
  const textStyle = new TextStyle({
    fontFamily: "Courier New",
    fontSize: 10,
    fill: 0xffffff,
  });

  // Cache for base textures created from HTMLImageElements
  const baseTextureCache = new Map<HTMLImageElement, Texture>();

  // Cache for frame textures (keyed by image + frame coordinates)
  const frameTextureCache = new Map<string, Texture>();

  function getBaseTexture(image: HTMLImageElement): Texture {
    let texture = baseTextureCache.get(image);
    if (!texture) {
      texture = Texture.from(image);
      baseTextureCache.set(image, texture);
    }
    return texture;
  }

  function getFrameTexture(image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number): Texture {
    const key = `${image.src}:${sx},${sy},${sw},${sh}`;
    let texture = frameTextureCache.get(key);
    if (!texture) {
      const baseTexture = getBaseTexture(image);
      const frame = new Rectangle(sx, sy, sw, sh);
      texture = new Texture({
        source: baseTexture.source,
        frame,
      });
      frameTextureCache.set(key, texture);
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
      sprite.alpha = 1;
      spriteIndex++;
      return sprite;
    }
    const sprite = new Sprite();
    spritePool.push(sprite);
    cameraContainer.addChild(sprite);
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
    const text = new Text({ text: "", style: textStyle.clone() });
    textPool.push(text);
    cameraContainer.addChild(text);
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

  // Transform state stack (simulating ctx.save/restore)
  type TransformState = { x: number; y: number; scaleX: number; scaleY: number; alpha: number };
  const transformStack: TransformState[] = [];
  let currentTransform: TransformState = { x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1 };

  // Create a proxy ctx object that tracks transforms
  const ctxProxy = {
    save() {
      transformStack.push({ ...currentTransform });
    },
    restore() {
      const prev = transformStack.pop();
      if (prev) {
        currentTransform = prev;
        cameraContainer.x = currentTransform.x;
        cameraContainer.y = currentTransform.y;
        cameraContainer.scale.x = currentTransform.scaleX;
        cameraContainer.scale.y = currentTransform.scaleY;
        cameraContainer.alpha = currentTransform.alpha;
      }
    },
    translate(x: number, y: number) {
      currentTransform.x += x;
      currentTransform.y += y;
      cameraContainer.x = currentTransform.x;
      cameraContainer.y = currentTransform.y;
    },
    scale(x: number, y: number) {
      currentTransform.scaleX *= x;
      currentTransform.scaleY *= y;
      cameraContainer.scale.x = currentTransform.scaleX;
      cameraContainer.scale.y = currentTransform.scaleY;
    },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      // Reset to identity-ish transform
      currentTransform = { x: e, y: f, scaleX: a, scaleY: d, alpha: currentTransform.alpha };
      cameraContainer.x = currentTransform.x;
      cameraContainer.y = currentTransform.y;
      cameraContainer.scale.x = currentTransform.scaleX;
      cameraContainer.scale.y = currentTransform.scaleY;
    },
    get globalAlpha() {
      return currentTransform.alpha;
    },
    set globalAlpha(value: number) {
      currentTransform.alpha = value;
      cameraContainer.alpha = value;
    },
    // Stubs for unused properties
    fillStyle: "",
    strokeStyle: "",
    font: "",
    fillRect() {},
    fillText() {},
    beginPath() {},
    arc() {},
    fill() {},
    drawImage() {},
  } as unknown as CanvasRenderingContext2D;

  const renderer: PixiRenderer = {
    app,
    stage: cameraContainer,

    clear(color: string) {
      // Reset transform
      currentTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, alpha: 1 };
      transformStack.length = 0;
      cameraContainer.x = 0;
      cameraContainer.y = 0;
      cameraContainer.scale.set(1, 1);
      cameraContainer.alpha = 1;

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
      
      // Remove old graphics and create fresh one
      cameraContainer.removeChild(graphics);
      graphics.destroy();
      graphics = new Graphics();
      cameraContainer.addChildAt(graphics, 0);
      
      // Set background color
      app.renderer.background.color = parseColor(color);
    },

    rect(x: number, y: number, w: number, h: number, color: string) {
      graphics.rect(Math.round(x), Math.round(y), w, h);
      graphics.fill({ color: parseColor(color), alpha: currentTransform.alpha });
    },

    circle(x: number, y: number, r: number, color: string) {
      graphics.circle(x, y, r);
      graphics.fill({ color: parseColor(color), alpha: currentTransform.alpha });
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
      const sprite = getSprite();
      
      // Get cached frame texture (avoids recreating on every draw)
      sprite.texture = getFrameTexture(image, sx, sy, sw, sh);
      
      sprite.width = dw;
      sprite.height = dh;
      sprite.alpha = currentTransform.alpha;
      
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
      textObj.alpha = currentTransform.alpha;
    },

    ctx: ctxProxy,

    destroy() {
      baseTextureCache.clear();
      frameTextureCache.clear();
      app.destroy(true);
    },

    render() {
      // Present the frame - must be called at the end of each render cycle
      app.render();
    },
  };

  return renderer;
}
