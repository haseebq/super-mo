const TILE_SIZE = 16;

export function createLevel1() {
  const width = 20;
  const height = 12;
  const tiles = new Array(width * height).fill(0);
  const coins = [];
  const shards = [];

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

  coins.push(createCoin(2, 9));
  coins.push(createCoin(3, 9));
  coins.push(createCoin(4, 9));
  coins.push(createCoin(10, 6));
  coins.push(createCoin(14, 8));
  shards.push(createShard(6, 7));

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
    coins,
    shards,
  };
}

function createCoin(x, y) {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    width: 16,
    height: 16,
    collected: false,
    type: "coin",
  };
}

function createShard(x, y) {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    width: 16,
    height: 16,
    collected: false,
    type: "shard",
  };
}

export function isSolid(id) {
  return id === 1 || id === 2;
}
