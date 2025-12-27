export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
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
