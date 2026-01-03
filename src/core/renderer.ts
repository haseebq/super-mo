export type RenderFilterSpec =
  | { type: "blur"; strength?: number; quality?: number }
  | { type: "grayscale"; amount?: number }
  | { type: "sepia" }
  | { type: "contrast"; amount?: number }
  | { type: "brightness"; amount?: number }
  | { type: "saturate"; amount?: number }
  | { type: "hue"; rotation?: number }
  | { type: "negative" };

export type Renderer = {
  clear: (color: string) => void;
  rect: (x: number, y: number, w: number, h: number, color: string) => void;
  circle: (x: number, y: number, r: number, color: string) => void;
  sprite: (
    image: HTMLImageElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
    flipX?: boolean
  ) => void;
  text: (text: string, x: number, y: number, color: string) => void;
  ctx: CanvasRenderingContext2D;
  render?: () => void; // Optional: present frame (used by Pixi renderer)
  resize?: () => void; // Optional: resize to match CSS display size
  setFilters?: (filters: RenderFilterSpec[] | null) => void;
};

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available.");
  }
  ctx.imageSmoothingEnabled = true;

  return {
    clear(color) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    },
    circle(x, y, r, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    },
    sprite(image, sx, sy, sw, sh, dx, dy, dw = sw, dh = sh, flipX = false) {
      if (flipX) {
        ctx.save();
        ctx.translate(Math.round(dx) + dw / 2, Math.round(dy) + dh / 2);
        ctx.scale(-1, 1);
        ctx.drawImage(image, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(image, sx, sy, sw, sh, Math.round(dx), Math.round(dy), dw, dh);
      }
    },
    text(text, x, y, color) {
      ctx.fillStyle = color;
      ctx.font = "10px Courier New";
      ctx.fillText(text, x, y);
    },
    ctx,
  };
}
