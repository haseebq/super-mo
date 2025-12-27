export type Renderer = {
  clear: (color: string) => void;
  rect: (x: number, y: number, w: number, h: number, color: string) => void;
  sprite: (
    image: HTMLImageElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number
  ) => void;
  text: (text: string, x: number, y: number, color: string) => void;
  ctx: CanvasRenderingContext2D;
};

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available.");
  }
  ctx.imageSmoothingEnabled = false;

  return {
    clear(color) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    },
    sprite(image, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
      ctx.drawImage(image, sx, sy, sw, sh, Math.round(dx), Math.round(dy), dw, dh);
    },
    text(text, x, y, color) {
      ctx.fillStyle = color;
      ctx.font = "10px Courier New";
      ctx.fillText(text, x, y);
    },
    ctx,
  };
}
