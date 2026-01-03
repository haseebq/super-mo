import type {
  BackgroundThemePatch,
  GamePatch,
  GameStateSnapshot,
  ModOperation,
  ModdingResult,
  OpRemoveEntities,
  OpRunScript,
  OpSetEntityScript,
  OpSetMusic,
  OpSetRenderFilters,
} from "./types.js";
import { activeRules, updateRule } from "./rules.js";
import type { ModdingRules } from "./rules.js";

export interface GameEngineAdapter {
  getState: () => any;
  removeEntities: (filter: OpRemoveEntities["filter"]) => number;
  setPlayerAbility: (ability: string, active: boolean) => void;
  setAudioMuted?: (muted: boolean) => void;
  setBackgroundTheme?: (theme: BackgroundThemePatch | null) => void;
  setRenderFilters?: (filters: OpSetRenderFilters["filters"]) => void;
  reloadAssets?: () => void | Promise<void>;
  runScript?: (request: OpRunScript) => Promise<{ ops: Array<Record<string, unknown>> }>;
  setEntityScript?: (target: OpSetEntityScript["target"], script: string) => void;
  setMusic?: (op: OpSetMusic) => void;
}

type ModdingSnapshot = {
  rules: ModdingRules;
  audioMuted: boolean;
  backgroundOverride: BackgroundThemePatch | null;
  renderFilters: OpSetRenderFilters["filters"];
  invulnerableTimer: number;
  coins: boolean[];
  enemies: boolean[];
  hud: {
    coins: number;
    shards: number;
    score: number;
    lives: number;
  };
};

type PatchLogEntry = {
  id: string;
  timestamp: number;
  prompt: string;
  explanation: string;
  ops: ModOperation[];
  appliedOps: number;
  snapshot: ModdingSnapshot;
};

type PatchLogMeta = {
  prompt?: string;
  explanation?: string;
};

function createPatchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `patch_${Math.random().toString(36).slice(2)}${Date.now()}`;
}

export class ModdingAPI {
  private patchLog: PatchLogEntry[] = [];
  private readonly maxLogEntries = 25;

  constructor(private adapter: GameEngineAdapter) {}

  getSnapshot(): GameStateSnapshot {
    const state = this.adapter.getState();
    return {
      version: 1,
      frame: Math.floor(state.time * 60),
      rules: JSON.parse(JSON.stringify(activeRules)),
      player: {
        position: { x: state.player.x, y: state.player.y },
        velocity: { x: state.player.vx, y: state.player.vy },
        stats: {
          coins: state.hud.coins,
          lives: state.hud.lives,
        },
        abilities: {
          canFly: state.player.vy === 0 && !state.player.onGround, // Proxy for now
          invincible: state.invulnerableTimer > 0,
        },
      },
      entities: {
        coins: state.level.coins.filter((c: any) => !c.collected).length,
        enemies: state.enemies.filter((e: any) => e.alive).length,
      },
      audio: {
        muted: Boolean(state.audioMuted),
      },
      rendering: {
        backgroundOverride: (state.backgroundOverride ?? null) as
          | BackgroundThemePatch
          | null,
        filters: (state.renderFilters ?? null) as OpSetRenderFilters["filters"],
      },
      assets: {
        ready: Boolean(state.assetsReady),
      },
    };
  }

  async applyPatch(patch: GamePatch, meta: PatchLogMeta = {}): Promise<ModdingResult> {
    const snapshot = this.captureSnapshot();
    const result = await this.applyOps(patch.ops, 0);

    if (result.applied > 0) {
      this.recordPatch(patch, snapshot, meta, result.applied);
    }

    return {
      success: result.errors.length === 0,
      appliedOps: result.applied,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
  }

  getPatchLog(): PatchLogEntry[] {
    return this.patchLog.slice();
  }

  rollbackLastPatch(): ModdingResult {
    const entry = this.patchLog.pop();
    if (!entry) {
      return {
        success: false,
        appliedOps: 0,
        errors: ["No patch history to rollback."],
      };
    }
    this.restoreSnapshot(entry.snapshot);
    return { success: true, appliedOps: 0 };
  }

  private async applyOps(
    ops: ModOperation[],
    depth: number
  ): Promise<{ applied: number; errors: string[] }> {
    const errors: string[] = [];
    let applied = 0;
    const maxDepth = 2;

    if (depth > maxDepth) {
      return {
        applied,
        errors: ["Script nesting limit reached."],
      };
    }

    // TODO: Transactional validation could go here.
    // For now, we apply sequentially and report errors.

    for (const op of ops) {
      if (op.op === "setRule") {
        if (updateRule(op.path, op.value)) {
          applied++;
        } else {
          errors.push(`Invalid rule path: ${op.path}`);
        }
      } else if (op.op === "removeEntities") {
        const count = this.adapter.removeEntities(op.filter);
        if (count >= 0) applied++;
      } else if (op.op === "setAbility") {
        this.adapter.setPlayerAbility(op.ability, op.active);
        applied++;
      } else if (op.op === "setAudio") {
        if (!this.adapter.setAudioMuted) {
          errors.push("Audio control not available.");
          continue;
        }
        if (typeof op.muted !== "boolean") {
          errors.push("Audio operation missing muted flag.");
          continue;
        }
        this.adapter.setAudioMuted(op.muted);
        applied++;
      } else if (op.op === "setBackgroundTheme") {
        if (!this.adapter.setBackgroundTheme) {
          errors.push("Background theme control not available.");
          continue;
        }
        this.adapter.setBackgroundTheme(op.theme ?? null);
        applied++;
      } else if (op.op === "setRenderFilters") {
        if (!this.adapter.setRenderFilters) {
          errors.push("Render filter control not available.");
          continue;
        }
        const filters = op.filters ?? null;
        if (filters !== null && !Array.isArray(filters)) {
          errors.push("Render filters must be an array or null.");
          continue;
        }
        this.adapter.setRenderFilters(filters);
        applied++;
      } else if (op.op === "reloadAssets") {
        if (!this.adapter.reloadAssets) {
          errors.push("Asset reload not available.");
          continue;
        }
        await this.adapter.reloadAssets();
        applied++;
      } else if (op.op === "setEntityScript") {
        if (!this.adapter.setEntityScript) {
          errors.push("Entity script not available.");
          continue;
        }
        if (!op.script || typeof op.script !== "string") {
          errors.push("Entity script missing script payload.");
          continue;
        }
        this.adapter.setEntityScript(op.target, op.script);
        applied++;
      } else if (op.op === "setMusic") {
        if (!this.adapter.setMusic) {
          errors.push("Music control not available.");
          continue;
        }
        this.adapter.setMusic(op);
        applied++;
      } else if (op.op === "runScript") {
        if (!this.adapter.runScript) {
          errors.push("Script execution not available.");
          continue;
        }
        if (!op.code && !op.module) {
          errors.push("Script operation missing code or module payload.");
          continue;
        }
        try {
          const scriptResult = await this.adapter.runScript(op);
          applied++;
          if (!scriptResult || !Array.isArray(scriptResult.ops)) {
            errors.push("Script returned no operations.");
            continue;
          }
          const nested = await this.applyOps(
            scriptResult.ops as ModOperation[],
            depth + 1
          );
          applied += nested.applied;
          errors.push(...nested.errors);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Script error: ${message}`);
        }
      } else {
        errors.push(`Unknown operation: ${(op as any).op}`);
      }
    }

    return { applied, errors };
  }

  private captureSnapshot(): ModdingSnapshot {
    const state = this.adapter.getState();
    return {
      rules: JSON.parse(JSON.stringify(activeRules)) as ModdingRules,
      audioMuted: Boolean(state.audioMuted),
      backgroundOverride: state.backgroundOverride
        ? (JSON.parse(JSON.stringify(state.backgroundOverride)) as BackgroundThemePatch)
        : null,
      renderFilters: Array.isArray(state.renderFilters)
        ? state.renderFilters.map((filter: Record<string, unknown>) => ({ ...filter }))
        : null,
      invulnerableTimer:
        typeof state.invulnerableTimer === "number" ? state.invulnerableTimer : 0,
      coins: Array.isArray(state.level?.coins)
        ? state.level.coins.map((coin: { collected?: boolean }) => Boolean(coin.collected))
        : [],
      enemies: Array.isArray(state.enemies)
        ? state.enemies.map((enemy: { alive?: boolean }) => Boolean(enemy.alive))
        : [],
      hud: {
        coins: typeof state.hud?.coins === "number" ? state.hud.coins : 0,
        shards: typeof state.hud?.shards === "number" ? state.hud.shards : 0,
        score: typeof state.hud?.score === "number" ? state.hud.score : 0,
        lives: typeof state.hud?.lives === "number" ? state.hud.lives : 0,
      },
    };
  }

  private restoreSnapshot(snapshot: ModdingSnapshot): void {
    Object.assign(activeRules, JSON.parse(JSON.stringify(snapshot.rules)));

    if (this.adapter.setAudioMuted) {
      this.adapter.setAudioMuted(snapshot.audioMuted);
    }
    if (this.adapter.setBackgroundTheme) {
      this.adapter.setBackgroundTheme(snapshot.backgroundOverride);
    }
    if (this.adapter.setRenderFilters) {
      this.adapter.setRenderFilters(snapshot.renderFilters);
    }

    const state = this.adapter.getState();
    if (state && typeof state.invulnerableTimer === "number") {
      state.invulnerableTimer = snapshot.invulnerableTimer;
    }
    if (Array.isArray(state?.level?.coins)) {
      state.level.coins.forEach((coin: { collected?: boolean }, index: number) => {
        if (typeof snapshot.coins[index] === "boolean") {
          coin.collected = snapshot.coins[index];
        }
      });
    }
    if (Array.isArray(state?.enemies)) {
      state.enemies.forEach((enemy: { alive?: boolean }, index: number) => {
        if (typeof snapshot.enemies[index] === "boolean") {
          enemy.alive = snapshot.enemies[index];
        }
      });
    }
    if (state?.hud) {
      state.hud.coins = snapshot.hud.coins;
      state.hud.shards = snapshot.hud.shards;
      state.hud.score = snapshot.hud.score;
      state.hud.lives = snapshot.hud.lives;
    }
  }

  private recordPatch(
    patch: GamePatch,
    snapshot: ModdingSnapshot,
    meta: PatchLogMeta,
    appliedOps: number
  ): void {
    const entry: PatchLogEntry = {
      id: createPatchId(),
      timestamp: Date.now(),
      prompt: meta.prompt ?? "",
      explanation: meta.explanation ?? "",
      ops: JSON.parse(JSON.stringify(patch.ops)) as ModOperation[],
      appliedOps,
      snapshot,
    };
    this.patchLog.push(entry);
    if (this.patchLog.length > this.maxLogEntries) {
      this.patchLog.shift();
    }
  }
}
