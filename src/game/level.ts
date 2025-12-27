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

export type Powerup = Rect & {
  collected: boolean;
  kind: "spring" | "speed" | "shield";
};

export type Level = {
  width: number;
  height: number;
  tileSize: number;
  tiles: number[];
  coins: Collectible[];
  shards: Collectible[];
  goal: Rect;
  landmark: Rect;
  powerups: Powerup[];
};

const TILE_SIZE = 16;

export function createLevel1(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const goal: Rect = { x: 76 * TILE_SIZE, y: 10 * TILE_SIZE, width: 16, height: 16 };
  const landmark: Rect = { x: 74 * TILE_SIZE, y: 7 * TILE_SIZE, width: 32, height: 48 };

  const setTile = (x: number, y: number, id: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    tiles[y * width + x] = id;
  };
  const placePlatform = (startX: number, endX: number, y: number) => {
    for (let x = startX; x <= endX; x += 1) {
      setTile(x, y, 2);
    }
  };

  const gaps = [
    { start: 18, end: 20 },
    { start: 36, end: 38 },
    { start: 56, end: 58 },
  ];

  for (let x = 0; x < width; x += 1) {
    const isGap = gaps.some((gap) => x >= gap.start && x <= gap.end);
    if (!isGap) {
      setTile(x, height - 1, 1);
    }
  }

  placePlatform(6, 9, 8);
  placePlatform(14, 16, 7);
  placePlatform(24, 27, 6);
  placePlatform(30, 32, 8);
  placePlatform(42, 45, 7);
  placePlatform(48, 51, 6);
  placePlatform(62, 65, 8);
  placePlatform(70, 73, 7);

  setTile(76, 10, 3);

  coins.push(createCoin(2, 9));
  coins.push(createCoin(3, 9));
  coins.push(createCoin(4, 9));
  coins.push(createCoin(7, 7));
  coins.push(createCoin(15, 6));
  coins.push(createCoin(25, 5));
  coins.push(createCoin(31, 7));
  coins.push(createCoin(43, 6));
  coins.push(createCoin(49, 5));
  coins.push(createCoin(63, 7));
  coins.push(createCoin(71, 6));
  coins.push(createCoin(75, 9));
  shards.push(createShard(50, 4));
  powerups.push(createPowerup(28, 5, "spring"));
  powerups.push(createPowerup(34, 9, "speed"));
  powerups.push(createPowerup(60, 5, "shield"));

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
    coins,
    shards,
    goal,
    landmark,
    powerups,
  };
}

export function createLevel2(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const goal: Rect = { x: 76 * TILE_SIZE, y: 9 * TILE_SIZE, width: 16, height: 16 };
  const landmark: Rect = { x: 72 * TILE_SIZE, y: 6 * TILE_SIZE, width: 48, height: 64 };

  const setTile = (x: number, y: number, id: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    tiles[y * width + x] = id;
  };
  const placePlatform = (startX: number, endX: number, y: number) => {
    for (let x = startX; x <= endX; x += 1) {
      setTile(x, y, 2);
    }
  };

  const gaps = [
    { start: 10, end: 12 },
    { start: 26, end: 28 },
    { start: 44, end: 46 },
    { start: 62, end: 64 },
  ];

  for (let x = 0; x < width; x += 1) {
    const isGap = gaps.some((gap) => x >= gap.start && x <= gap.end);
    if (!isGap) {
      setTile(x, height - 1, 1);
    }
  }

  placePlatform(5, 8, 8);
  placePlatform(14, 16, 6);
  placePlatform(20, 23, 7);
  placePlatform(30, 33, 5);
  placePlatform(38, 41, 7);
  placePlatform(48, 50, 6);
  placePlatform(54, 57, 8);
  placePlatform(66, 69, 6);

  setTile(76, 9, 3);

  coins.push(createCoin(2, 9));
  coins.push(createCoin(6, 7));
  coins.push(createCoin(15, 5));
  coins.push(createCoin(21, 6));
  coins.push(createCoin(31, 4));
  coins.push(createCoin(39, 6));
  coins.push(createCoin(49, 5));
  coins.push(createCoin(55, 7));
  coins.push(createCoin(67, 5));
  coins.push(createCoin(74, 8));
  shards.push(createShard(34, 3));
  shards.push(createShard(58, 4));
  powerups.push(createPowerup(24, 6, "speed"));
  powerups.push(createPowerup(52, 5, "spring"));

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
    coins,
    shards,
    goal,
    landmark,
    powerups,
  };
}

export function createLevel3(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const goal: Rect = { x: 76 * TILE_SIZE, y: 8 * TILE_SIZE, width: 16, height: 16 };
  const landmark: Rect = { x: 70 * TILE_SIZE, y: 5 * TILE_SIZE, width: 56, height: 72 };

  const setTile = (x: number, y: number, id: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }
    tiles[y * width + x] = id;
  };
  const placePlatform = (startX: number, endX: number, y: number) => {
    for (let x = startX; x <= endX; x += 1) {
      setTile(x, y, 2);
    }
  };

  const gaps = [
    { start: 12, end: 14 },
    { start: 22, end: 24 },
    { start: 40, end: 42 },
    { start: 50, end: 52 },
    { start: 60, end: 62 },
  ];

  for (let x = 0; x < width; x += 1) {
    const isGap = gaps.some((gap) => x >= gap.start && x <= gap.end);
    if (!isGap) {
      setTile(x, height - 1, 1);
    }
  }

  placePlatform(4, 7, 7);
  placePlatform(16, 19, 6);
  placePlatform(26, 29, 8);
  placePlatform(34, 36, 5);
  placePlatform(44, 46, 7);
  placePlatform(54, 56, 6);
  placePlatform(64, 67, 7);
  placePlatform(72, 74, 6);

  setTile(76, 8, 3);

  coins.push(createCoin(3, 9));
  coins.push(createCoin(5, 6));
  coins.push(createCoin(17, 5));
  coins.push(createCoin(27, 7));
  coins.push(createCoin(35, 4));
  coins.push(createCoin(45, 6));
  coins.push(createCoin(55, 5));
  coins.push(createCoin(65, 6));
  coins.push(createCoin(73, 5));
  shards.push(createShard(30, 4));
  shards.push(createShard(48, 5));
  powerups.push(createPowerup(18, 6, "shield"));
  powerups.push(createPowerup(58, 5, "speed"));

  return {
    width,
    height,
    tileSize: TILE_SIZE,
    tiles,
    coins,
    shards,
    goal,
    landmark,
    powerups,
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

function createPowerup(x: number, y: number, kind: Powerup["kind"]): Powerup {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    width: 16,
    height: 16,
    collected: false,
    kind,
  };
}

export function isSolid(id: number): boolean {
  return id === 1 || id === 2;
}
