import type {
  GamePatch,
  GameStateSnapshot,
  ModdingResult,
  OpRemoveEntities,
} from "./types.js";
import { activeRules, updateRule } from "./rules.js";

export interface GameEngineAdapter {
  getState: () => any;
  removeEntities: (filter: OpRemoveEntities["filter"]) => number;
  setPlayerAbility: (ability: string, active: boolean) => void;
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
    };
  }

  applyPatch(patch: GamePatch): ModdingResult {
    const errors: string[] = [];
    let applied = 0;

    // TODO: Transactional validation could go here.
    // For now, we apply sequentially and report errors.

    for (const op of patch.ops) {
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
      } else {
        errors.push(`Unknown operation: ${(op as any).op}`);
      }
    }

    return {
      success: errors.length === 0,
      appliedOps: applied,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
