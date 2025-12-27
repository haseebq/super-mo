const TILE_SIZE = 16;

export function createLevel1() {
  const width = 20;
  const height = 12;
  const tiles = new Array(width * height).fill(0);

  const setTile = (x, y, id) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    tiles[y * width + x] = id;
  };

  for (let x = 0; x < width; x += 1) {
    setTile(x, height - 1, 1);
  }

  for (let x = 4; x < 7; x += 1) {
    setTile(x, 8, 2);
  }

  setTile(10, 7, 2);
  setTile(11, 7, 2);
  setTile(14, 9, 2);

  setTile(18, 10, 3);

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
  };
}

export function isSolid(id) {
  return id === 1 || id === 2;
}
