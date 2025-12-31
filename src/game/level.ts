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
  kind: "spring" | "speed" | "shield" | "jetpack" | "rocket";
};

export type MovingPlatform = Rect & {
  kind: "vertical" | "circular";
  baseX: number;
  baseY: number;
  amplitude: number;
  period: number;
  radius: number;
  angle: number;
  deltaX: number;
  deltaY: number;
};

export type Checkpoint = Rect & {
  activated: boolean;
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
  platforms: MovingPlatform[];
  checkpoints: Checkpoint[];
};

const TILE_SIZE = 16;

export function createLevel1(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const platforms: MovingPlatform[] = [];
  const checkpoints: Checkpoint[] = [];
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

  // Spike hazards
  setTile(18, 10, 4);
  setTile(38, 10, 4);
  setTile(58, 10, 4);

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
  for (let x = 10; x <= 16; x += 2) {
    coins.push(createCoin(x, 9));
  }
  for (let x = 20; x <= 28; x += 2) {
    coins.push(createCoin(x, 9));
  }
  for (let x = 34; x <= 42; x += 2) {
    coins.push(createCoin(x, 8));
  }
  for (let x = 54; x <= 62; x += 2) {
    coins.push(createCoin(x, 9));
  }
  shards.push(createShard(50, 4));
  powerups.push(createPowerup(28, 5, "spring"));
  powerups.push(createPowerup(34, 9, "speed"));
  powerups.push(createPowerup(60, 5, "shield"));
  powerups.push(createPowerup(45, 6, "jetpack"));
  platforms.push(createVerticalPlatform(20, 9, 3, 3));
  platforms.push(createCircularPlatform(40, 8, 2.5, 3.5));
  checkpoints.push(createCheckpoint(40, 9));

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
    platforms,
    checkpoints,
  };
}

export function createLevel2(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const platforms: MovingPlatform[] = [];
  const checkpoints: Checkpoint[] = [];
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
  powerups.push(createPowerup(4, 10, "rocket"));
  powerups.push(createPowerup(24, 6, "speed"));
  powerups.push(createPowerup(52, 5, "spring"));
  powerups.push(createPowerup(40, 6, "jetpack"));
  platforms.push(createVerticalPlatform(12, 8, 2.5, 3));
  checkpoints.push(createCheckpoint(44, 9));

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
    platforms,
    checkpoints,
  };
}

export function createLevel3(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const platforms: MovingPlatform[] = [];
  const checkpoints: Checkpoint[] = [];
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
  checkpoints.push(createCheckpoint(40, 9));
  platforms.push(createCircularPlatform(46, 6, 2, 3));

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
    platforms,
    checkpoints,
  };
}

export function createLevel4(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const platforms: MovingPlatform[] = [];
  const checkpoints: Checkpoint[] = [];
  const goal: Rect = { x: 76 * TILE_SIZE, y: 9 * TILE_SIZE, width: 16, height: 16 };
  const landmark: Rect = { x: 71 * TILE_SIZE, y: 6 * TILE_SIZE, width: 48, height: 64 };

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
    { start: 8, end: 10 },
    { start: 18, end: 20 },
    { start: 34, end: 36 },
    { start: 52, end: 54 },
    { start: 66, end: 68 },
  ];

  for (let x = 0; x < width; x += 1) {
    const isGap = gaps.some((gap) => x >= gap.start && x <= gap.end);
    if (!isGap) {
      setTile(x, height - 1, 1);
    }
  }

  placePlatform(4, 6, 7);
  placePlatform(12, 15, 6);
  placePlatform(22, 25, 8);
  placePlatform(30, 33, 5);
  placePlatform(38, 41, 7);
  placePlatform(46, 49, 6);
  placePlatform(56, 59, 8);
  placePlatform(62, 64, 6);
  placePlatform(70, 73, 7);

  setTile(76, 9, 3);

  coins.push(createCoin(2, 9));
  coins.push(createCoin(5, 6));
  coins.push(createCoin(13, 5));
  coins.push(createCoin(23, 7));
  coins.push(createCoin(31, 4));
  coins.push(createCoin(39, 6));
  coins.push(createCoin(47, 5));
  coins.push(createCoin(57, 7));
  coins.push(createCoin(63, 5));
  coins.push(createCoin(71, 6));
  shards.push(createShard(26, 4));
  shards.push(createShard(60, 4));
  powerups.push(createPowerup(16, 6, "spring"));
  powerups.push(createPowerup(52, 5, "shield"));
  platforms.push(createVerticalPlatform(34, 8, 2, 2.8));
  checkpoints.push(createCheckpoint(36, 9));

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
    platforms,
    checkpoints,
  };
}

export function createLevel5(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const platforms: MovingPlatform[] = [];
  const checkpoints: Checkpoint[] = [];
  const goal: Rect = { x: 76 * TILE_SIZE, y: 8 * TILE_SIZE, width: 16, height: 16 };
  const landmark: Rect = { x: 69 * TILE_SIZE, y: 5 * TILE_SIZE, width: 56, height: 72 };

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
    { start: 14, end: 16 },
    { start: 24, end: 26 },
    { start: 36, end: 38 },
    { start: 48, end: 50 },
    { start: 58, end: 60 },
  ];

  for (let x = 0; x < width; x += 1) {
    const isGap = gaps.some((gap) => x >= gap.start && x <= gap.end);
    if (!isGap) {
      setTile(x, height - 1, 1);
    }
  }

  placePlatform(6, 9, 8);
  placePlatform(18, 21, 6);
  placePlatform(28, 31, 7);
  placePlatform(40, 43, 5);
  placePlatform(46, 47, 7);
  placePlatform(52, 55, 6);
  placePlatform(62, 65, 8);
  placePlatform(70, 72, 6);

  setTile(76, 8, 3);

  coins.push(createCoin(3, 9));
  coins.push(createCoin(7, 7));
  coins.push(createCoin(19, 5));
  coins.push(createCoin(29, 6));
  coins.push(createCoin(41, 4));
  coins.push(createCoin(53, 5));
  coins.push(createCoin(63, 7));
  coins.push(createCoin(71, 5));
  shards.push(createShard(24, 4));
  shards.push(createShard(56, 4));
  powerups.push(createPowerup(12, 7, "speed"));
  powerups.push(createPowerup(58, 5, "spring"));
  checkpoints.push(createCheckpoint(40, 9));
  platforms.push(createCircularPlatform(36, 7, 2.5, 3));

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
    platforms,
    checkpoints,
  };
}

export function createLevel6(): Level {
  const width = 80;
  const height = 12;
  const tiles = new Array<number>(width * height).fill(0);
  const coins: Collectible[] = [];
  const shards: Collectible[] = [];
  const powerups: Powerup[] = [];
  const platforms: MovingPlatform[] = [];
  const checkpoints: Checkpoint[] = [];
  const goal: Rect = { x: 76 * TILE_SIZE, y: 8 * TILE_SIZE, width: 16, height: 16 };
  const landmark: Rect = { x: 68 * TILE_SIZE, y: 5 * TILE_SIZE, width: 56, height: 72 };

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
    { start: 6, end: 8 },
    { start: 20, end: 22 },
    { start: 32, end: 34 },
    { start: 46, end: 48 },
    { start: 56, end: 58 },
    { start: 66, end: 68 },
  ];

  for (let x = 0; x < width; x += 1) {
    const isGap = gaps.some((gap) => x >= gap.start && x <= gap.end);
    if (!isGap) {
      setTile(x, height - 1, 1);
    }
  }

  placePlatform(4, 5, 8);
  placePlatform(10, 12, 6);
  placePlatform(16, 18, 7);
  placePlatform(24, 27, 5);
  placePlatform(36, 39, 7);
  placePlatform(42, 44, 6);
  placePlatform(50, 53, 8);
  placePlatform(60, 62, 6);
  placePlatform(70, 73, 7);

  setTile(76, 8, 3);

  coins.push(createCoin(2, 9));
  coins.push(createCoin(11, 5));
  coins.push(createCoin(17, 6));
  coins.push(createCoin(25, 4));
  coins.push(createCoin(37, 6));
  coins.push(createCoin(43, 5));
  coins.push(createCoin(51, 7));
  coins.push(createCoin(61, 5));
  coins.push(createCoin(71, 6));
  shards.push(createShard(28, 4));
  shards.push(createShard(54, 4));
  powerups.push(createPowerup(14, 6, "shield"));
  powerups.push(createPowerup(48, 5, "speed"));
  platforms.push(createVerticalPlatform(24, 8, 3, 3.2));
  checkpoints.push(createCheckpoint(32, 9));

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
    platforms,
    checkpoints,
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

function createCheckpoint(x: number, y: number): Checkpoint {
  return {
    x: x * TILE_SIZE,
    y: y * TILE_SIZE,
    width: 16,
    height: 16,
    activated: false,
  };
}

function createVerticalPlatform(x: number, y: number, amplitude: number, period: number): MovingPlatform {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  return {
    x: px,
    y: py,
    width: 32,
    height: 8,
    kind: "vertical",
    baseX: px,
    baseY: py,
    amplitude: amplitude * TILE_SIZE,
    period,
    radius: 0,
    angle: 0,
    deltaX: 0,
    deltaY: 0,
  };
}

function createCircularPlatform(x: number, y: number, radius: number, period: number): MovingPlatform {
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  return {
    x: px,
    y: py,
    width: 32,
    height: 8,
    kind: "circular",
    baseX: px,
    baseY: py,
    amplitude: 0,
    period,
    radius: radius * TILE_SIZE,
    angle: 0,
    deltaX: 0,
    deltaY: 0,
  };
}

export function isSolid(id: number): boolean {
  return id === 1 || id === 2;
}

export function isSpike(id: number): boolean {
  return id === 4;
}
