/**
 * Tool Argument Types
 *
 * TypeScript type definitions for all tool call arguments.
 * These enable compile-time checking of tool calls.
 */

import {
  EngineState,
  EntityTemplate,
  ComponentData,
  System,
  CollisionHandler,
  Action,
} from "./state.js";
import { ExpressionContext } from "./expressions.js";
import { ActionContext } from "./actions.js";

// ============================================================================
// Simulation Tools
// ============================================================================

export interface StepArgs {
  frames?: number;
  dt?: number;
}

export interface DumpStateArgs {
  // No arguments
}

export interface LoadStateArgs {
  state: EngineState;
}

export interface QueryStateArgs {
  path?: string;
}

export interface GetFrameArgs {
  // No arguments
}

export interface GetTimeArgs {
  // No arguments
}

export interface GetModeArgs {
  // No arguments
}

// ============================================================================
// Entity Tools
// ============================================================================

export interface SpawnEntityArgs {
  template: string;
  at?: { x: number; y: number };
  id?: string;
  tags?: string[];
}

export interface CreateEntityArgs {
  id?: string;
  tags?: string[];
  components?: Record<string, ComponentData>;
}

export interface RemoveEntityArgs {
  id: string;
}

export interface GetEntityArgs {
  id: string;
}

export interface GetEntitiesArgs {
  tag?: string;
  has?: string[];
  not?: string[];
}

export interface SetComponentArgs {
  id: string;
  component: string;
  data: ComponentData;
}

export interface UpdateComponentArgs {
  id: string;
  path: string;
  value: unknown;
}

export interface RemoveComponentArgs {
  id: string;
  component: string;
}

export interface DefineTemplateArgs {
  name: string;
  template: EntityTemplate;
}

export interface GetTemplateArgs {
  name: string;
}

// ============================================================================
// Expression Tools
// ============================================================================

export interface EvaluateExpressionArgs {
  expression: string;
  context?: ExpressionContext;
}

export interface ValidateExpressionArgs {
  expression: string;
}

// ============================================================================
// Action Tools
// ============================================================================

export interface ExecuteActionArgs {
  action: Action;
  context?: Partial<ActionContext>;
}

export interface ExecuteActionsArgs {
  actions: Action[];
  context?: Partial<ActionContext>;
}

// ============================================================================
// System Tools
// ============================================================================

export interface DefineSystemArgs {
  system: System;
}

export interface RemoveSystemArgs {
  name: string;
}

export interface GetSystemArgs {
  name: string;
}

export interface GetSystemsArgs {
  // No arguments
}

export interface RunSystemsArgs {
  input?: Record<string, unknown>;
}

// ============================================================================
// Collision Tools
// ============================================================================

export interface DefineCollisionArgs {
  handler: CollisionHandler;
}

export interface RemoveCollisionArgs {
  between: [string, string];
}

export interface GetCollisionHandlersArgs {
  // No arguments
}

export interface DetectCollisionsArgs {
  // No arguments
}

export interface GetCollisionsLogArgs {
  // No arguments
}

// ============================================================================
// Event Tools
// ============================================================================

export interface DefineEventArgs {
  event: string;
  actions: Action[];
}

export interface RemoveEventArgs {
  event: string;
}

export interface GetEventArgs {
  event: string;
}

export interface GetEventsArgs {
  // No arguments
}

export interface TriggerEventArgs {
  event: string;
  data?: Record<string, unknown>;
}

export interface ProcessEventsArgs {
  events: Array<{ event: string; data?: Record<string, unknown> }>;
}

export interface GetEventsLogArgs {
  // No arguments
}

// ============================================================================
// Rules Tools
// ============================================================================

export interface GetRuleArgs {
  path: string;
}

export interface SetRuleArgs {
  path: string;
  value: unknown;
}

export interface GetRulesArgs {
  // No arguments
}

export interface GetPhysicsRulesArgs {
  // No arguments
}

export interface GetScoringRulesArgs {
  // No arguments
}

export interface GetControlsArgs {
  // No arguments
}

export interface SetControlArgs {
  action: string;
  key: string;
}

export interface ResetRulesArgs {
  // No arguments
}

// ============================================================================
// Modes and Screens Tools
// ============================================================================

export interface SetModeArgs {
  mode: string;
}

export interface DefineTransitionArgs {
  from: string;
  trigger: string;
  to: string;
}

export interface RemoveTransitionArgs {
  from: string;
  trigger: string;
}

export interface TriggerTransitionArgs {
  trigger: string;
}

export interface GetTransitionsArgs {
  from?: string;
}

export interface GetAvailableTriggersArgs {
  // No arguments
}

export interface GetScreenArgs {
  screen: string;
}

export interface SetScreenArgs {
  screen: string;
  config: Record<string, unknown>;
}

export interface UpdateScreenArgs {
  screen: string;
  property: string;
  value: unknown;
}

export interface GetScreensArgs {
  // No arguments
}

// ============================================================================
// Tool Name to Args Type Mapping
// ============================================================================

export interface ToolArgsMap {
  // Simulation
  step: StepArgs;
  dump_state: DumpStateArgs;
  load_state: LoadStateArgs;
  query_state: QueryStateArgs;
  get_frame: GetFrameArgs;
  get_time: GetTimeArgs;
  get_mode: GetModeArgs;

  // Entities
  spawn_entity: SpawnEntityArgs;
  create_entity: CreateEntityArgs;
  remove_entity: RemoveEntityArgs;
  get_entity: GetEntityArgs;
  get_entities: GetEntitiesArgs;
  set_component: SetComponentArgs;
  update_component: UpdateComponentArgs;
  remove_component: RemoveComponentArgs;
  define_template: DefineTemplateArgs;
  get_template: GetTemplateArgs;

  // Expressions
  evaluate_expression: EvaluateExpressionArgs;
  validate_expression: ValidateExpressionArgs;

  // Actions
  execute_action: ExecuteActionArgs;
  execute_actions: ExecuteActionsArgs;

  // Systems
  define_system: DefineSystemArgs;
  remove_system: RemoveSystemArgs;
  get_system: GetSystemArgs;
  get_systems: GetSystemsArgs;
  run_systems: RunSystemsArgs;

  // Collisions
  define_collision: DefineCollisionArgs;
  remove_collision: RemoveCollisionArgs;
  get_collision_handlers: GetCollisionHandlersArgs;
  detect_collisions: DetectCollisionsArgs;
  get_collisions_log: GetCollisionsLogArgs;

  // Events
  define_event: DefineEventArgs;
  remove_event: RemoveEventArgs;
  get_event: GetEventArgs;
  get_events: GetEventsArgs;
  trigger_event: TriggerEventArgs;
  process_events: ProcessEventsArgs;
  get_events_log: GetEventsLogArgs;

  // Rules
  get_rule: GetRuleArgs;
  set_rule: SetRuleArgs;
  get_rules: GetRulesArgs;
  get_physics_rules: GetPhysicsRulesArgs;
  get_scoring_rules: GetScoringRulesArgs;
  get_controls: GetControlsArgs;
  set_control: SetControlArgs;
  reset_rules: ResetRulesArgs;

  // Modes and Screens
  set_mode: SetModeArgs;
  define_transition: DefineTransitionArgs;
  remove_transition: RemoveTransitionArgs;
  trigger_transition: TriggerTransitionArgs;
  get_transitions: GetTransitionsArgs;
  get_available_triggers: GetAvailableTriggersArgs;
  get_screen: GetScreenArgs;
  set_screen: SetScreenArgs;
  update_screen: UpdateScreenArgs;
  get_screens: GetScreensArgs;
}

export type ToolName = keyof ToolArgsMap;
