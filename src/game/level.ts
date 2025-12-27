export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Collectible = Rect & {
  collected: boolean;
  type: "coin" | "shard";
};

export type Level = {
  width: number;
  height: number;
  tileSize: number;
  tiles: number[];
  coins: Collectible[];
  shards: Collectible[];
  goal: Rect;
};

const TILE_SIZE = 16;

export function createLevel1(): Level {
  const width = 20;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const goal: Rect = { x: 18 * TILE_SIZE, y: 10 * TILE_SIZE, width: 16, height: 16 };

  const setTile = (x: number, y: number, id: number) => {
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
    goal,
  };
}

function createCoin(x: number, y: number): Collectible {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    width: 16,
    height: 16,
    collected: false,
    type: "coin",
  };
}

function createShard(x: number, y: number): Collectible {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    width: 16,
    height: 16,
    collected: false,
    type: "shard",
  };
}

export function isSolid(id: number): boolean {
  return id === 1 || id === 2;
}
