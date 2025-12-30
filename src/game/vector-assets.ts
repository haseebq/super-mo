import { loadImage } from "../core/assets.js";

export type VectorSprite = {
  image: HTMLImageElement;
  w: number;
  h: number;
};

type VectorSpriteDef = {
  id: string;
  path: string;
  w: number;
  h: number;
};

const VECTOR_SPRITES: VectorSpriteDef[] = [
  { id: "player", path: "assets/vectors/sprites/player.svg", w: 16, h: 24 },
  {
    id: "player_run1",
    path: "assets/vectors/sprites/player_run1.svg",
    w: 16,
    h: 24,
  },
  {
    id: "player_run2",
    path: "assets/vectors/sprites/player_run2.svg",
    w: 16,
    h: 24,
  },
  {
    id: "player_jump",
    path: "assets/vectors/sprites/player_jump.svg",
    w: 16,
    h: 24,
  },
  {
    id: "player_death",
    path: "assets/vectors/sprites/player_death.svg",
    w: 16,
    h: 24,
  },
  {
    id: "moomba_walk1",
    path: "assets/vectors/sprites/moomba_walk1.svg",
    w: 16,
    h: 16,
  },
  {
    id: "moomba_walk2",
    path: "assets/vectors/sprites/moomba_walk2.svg",
    w: 16,
    h: 16,
  },
  { id: "moomba", path: "assets/vectors/sprites/moomba.svg", w: 16, h: 16 },
  { id: "flit", path: "assets/vectors/sprites/flit.svg", w: 16, h: 16 },
  {
    id: "spikelet",
    path: "assets/vectors/sprites/spikelet.svg",
    w: 16,
    h: 16,
  },
  { id: "coin", path: "assets/vectors/sprites/coin.svg", w: 16, h: 16 },
  { id: "shard", path: "assets/vectors/sprites/shard.svg", w: 16, h: 16 },
  { id: "block", path: "assets/vectors/sprites/block.svg", w: 16, h: 16 },
  { id: "goal", path: "assets/vectors/sprites/goal.svg", w: 16, h: 16 },
];

export async function loadVectorAssets(): Promise<Record<string, VectorSprite>> {
  const imageCache = new Map<string, HTMLImageElement>();
  const assets: Record<string, VectorSprite> = {};

  for (const sprite of VECTOR_SPRITES) {
    let image = imageCache.get(sprite.path);
    if (!image) {
      image = await loadImage(sprite.path);
      imageCache.set(sprite.path, image);
    }
    assets[sprite.id] = { image, w: sprite.w, h: sprite.h };
  }

  return assets;
}
