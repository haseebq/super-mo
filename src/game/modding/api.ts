import type {
  BackgroundThemePatch,
  GamePatch,
  GameStateSnapshot,
  ModOperation,
  ModdingResult,
  OpRemoveEntities,
  OpRunScript,
  OpSetRenderFilters,
} from "./types.js";
import { activeRules, updateRule } from "./rules.js";

export interface GameEngineAdapter {
  getState: () => any;
  removeEntities: (filter: OpRemoveEntities["filter"]) => number;
  setPlayerAbility: (ability: string, active: boolean) => void;
  setAudioMuted?: (muted: boolean) => void;
  setBackgroundTheme?: (theme: BackgroundThemePatch | null) => void;
  setRenderFilters?: (filters: OpSetRenderFilters["filters"]) => void;
  reloadAssets?: () => void | Promise<void>;
  runScript?: (request: OpRunScript) => Promise<{ ops: Array<Record<string, unknown>> }>;
}

export class ModdingAPI {
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

  async applyPatch(patch: GamePatch): Promise<ModdingResult> {
    const result = await this.applyOps(patch.ops, 0);
    return {
      success: result.errors.length === 0,
      appliedOps: result.applied,
      errors: result.errors.length > 0 ? result.errors : undefined,
    };
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
}
