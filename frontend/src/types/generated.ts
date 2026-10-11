/* GENERIERT von scripts/gen_types.sh aus den Pydantic-Modellen – nicht von Hand ändern. */

export interface SimulacraApi {
  ActionCompleted?: ActionCompleted;
  ActionInterrupted?: ActionInterrupted;
  ActionProblem?: ActionProblem;
  ActionStarted?: ActionStarted;
  AgentAdded?: AgentAdded;
  AgentDetail?: AgentDetail;
  Arrived?: Arrived;
  Ate?: Ate;
  ConversationEnded?: ConversationEnded;
  ConversationStarted?: ConversationStarted;
  DayStarted?: DayStarted;
  Decision?: Decision;
  DecisionFailed?: DecisionFailed;
  Dialogue?: Dialogue;
  Drank?: Drank;
  EventDetail?: EventDetail;
  EventOut?: EventOut;
  EventsPage?: EventsPage;
  Fished?: Fished;
  Inspected?: Inspected;
  InventoryChanged?: InventoryChanged;
  ItemGiven?: ItemGiven;
  ItemMoved?: ItemMoved;
  LocationChanged?: LocationChanged;
  LocationDetail?: LocationDetail;
  LocationDiscovered?: LocationDiscovered;
  LocationEvent?: LocationEvent;
  MapExtended?: MapExtended;
  Moved?: Moved;
  ObjectChanged?: ObjectChanged;
  ObjectCreated?: ObjectCreated;
  ObjectDiscovered?: ObjectDiscovered;
  ObjectRemoved?: ObjectRemoved;
  ParameterChanged?: ParameterChanged;
  PatchApplied?: PatchApplied;
  PhaseChanged?: PhaseChanged;
  ProposalAnswered?: ProposalAnswered;
  Read?: Read;
  ResetRequest?: ResetRequest;
  ResourceAdded?: ResourceAdded;
  ResourceChanged?: ResourceChanged;
  Rested?: Rested;
  SimCommandResult?: SimCommandResult;
  SimControl?: SimControl;
  SimReset?: SimReset;
  SimStepped?: SimStepped;
  SimTime?: SimTime;
  Slept?: Slept;
  SpeedChanged?: SpeedChanged;
  SpeedRequest?: SpeedRequest;
  StartRequest?: StartRequest;
  StateSnapshot?: StateSnapshot;
  StatusChanged?: StatusChanged;
  StepRequest?: StepRequest;
  TileChanged?: TileChanged;
  TileTypeAdded?: TileTypeAdded;
  TilesChanged?: TilesChanged;
  WeatherChanged?: WeatherChanged;
  WorldTime?: WorldTime;
  WsEvent?: WsEvent;
  WsEvents?: WsEvents;
  WsHello?: WsHello;
  WsPing?: WsPing;
  WsPong?: WsPong;
  WsResync?: WsResync;
  WsResyncRequired?: WsResyncRequired;
  WsSnapshot?: WsSnapshot;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ActionCompleted".
 */
export interface ActionCompleted {
  action: string;
  params?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ActionInterrupted".
 */
export interface ActionInterrupted {
  action: string;
  reason?: string;
}
/**
 * action_failed und action_rejected.
 *
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ActionProblem".
 */
export interface ActionProblem {
  action: string;
  code: string;
  params?: {
    [k: string]: unknown;
  };
  text: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ActionStarted".
 */
export interface ActionStarted {
  action: string;
  ends_at?: number | null;
  params?: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "AgentAdded".
 */
export interface AgentAdded {
  capacity: number;
  id: string;
  name: string;
  tile: number[];
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "AgentDetail".
 */
export interface AgentDetail {
  action: ActionInfo | null;
  capacity: number;
  conversation: {
    [k: string]: unknown;
  } | null;
  decisions: DecisionBrief[];
  facing: string;
  held: string[];
  id: string;
  inventory: {
    [k: string]: number;
  };
  last_seen: {
    [k: string]: unknown;
  };
  location_id: string;
  mood: string;
  name: string;
  needs: {
    [k: string]: number;
  };
  observations: ObservationBrief[];
  personality: {
    [k: string]: number;
  } | null;
  plan_next: string;
  profile: ProfileBrief | null;
  profile_full: {
    [k: string]: unknown;
  } | null;
  status: string;
  words: {
    [k: string]: string;
  };
  x: number;
  y: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ActionInfo".
 */
export interface ActionInfo {
  ends_at: number | null;
  params: {
    [k: string]: unknown;
  };
  started_at: number;
  type: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "DecisionBrief".
 */
export interface DecisionBrief {
  action: string | null;
  chosen: string | null;
  id: number;
  intent: string | null;
  options: {
    [k: string]: unknown;
  }[];
  outcome: string | null;
  outcome_text: string | null;
  sim_minute: number;
  status: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObservationBrief".
 */
export interface ObservationBrief {
  importance: number;
  kind: string;
  sim_minute: number;
  text: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ProfileBrief".
 */
export interface ProfileBrief {
  age: number;
  gender: string;
  goals: string[];
  name: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Arrived".
 */
export interface Arrived {
  at: number[];
  label?: string | null;
  target?: string | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Ate".
 */
export interface Ate {
  hunger: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ConversationEnded".
 */
export interface ConversationEnded {
  conversation: number;
  participants: string[];
  reason: string;
  reason_text: string;
  turns: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ConversationStarted".
 */
export interface ConversationStarted {
  by: string;
  conversation: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "DayStarted".
 */
export interface DayStarted {
  day: number;
  weekday: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Decision".
 */
export interface Decision {
  action: string;
  attempts?: number;
  chosen?: string | null;
  decision_id: number;
  factors?: unknown[][];
  importance?: number;
  intent?: string;
  latency_ms?: number;
  options?: OptionSummary[];
  params?: {
    [k: string]: unknown;
  };
  status: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "OptionSummary".
 */
export interface OptionSummary {
  id: string;
  kind: string;
  label: string;
  score: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "DecisionFailed".
 */
export interface DecisionFailed {
  attempts?: number;
  reason?: string | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Dialogue".
 */
export interface Dialogue {
  speaker: string;
  text: string;
  to: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Drank".
 */
export interface Drank {
  thirst: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "EventDetail".
 */
export interface EventDetail {
  chain: EventOut[];
  consequences: EventOut[];
  event: EventOut;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "EventOut".
 */
export interface EventOut {
  agents: string[];
  category: "world" | "dialogue" | "planning" | "memory" | "system";
  caused_by: string | null;
  data: {
    [k: string]: unknown;
  };
  id: string;
  location: string | null;
  seq: number;
  sim_time: SimTime;
  ts: string;
  type: string;
  visibility: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SimTime".
 */
export interface SimTime {
  day: number;
  minute: number;
  total: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "EventsPage".
 */
export interface EventsPage {
  items: EventOut[];
  last_seq: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Fished".
 */
export interface Fished {
  caught: boolean;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Inspected".
 */
export interface Inspected {
  amount?: number | null;
  node?: string | null;
  object?: ObjectData | null;
  requires_tool?: string | null;
  resource?: string | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObjectData".
 */
export interface ObjectData {
  holder?: string | null;
  id: string;
  kind: string;
  location_id?: string | null;
  name: string;
  state?: {
    [k: string]: unknown;
  };
  x?: number | null;
  y?: number | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "InventoryChanged".
 */
export interface InventoryChanged {
  delta: number;
  qty: number;
  resource: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ItemGiven".
 */
export interface ItemGiven {
  amount?: number | null;
  from: string;
  object?: ObjectData | null;
  resource?: string | null;
  to: string;
}
/**
 * item_taken und item_dropped.
 *
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ItemMoved".
 */
export interface ItemMoved {
  object: ObjectData;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "LocationChanged".
 */
export interface LocationChanged {
  from_location: string;
  to_location: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "LocationDetail".
 */
export interface LocationDetail {
  agents: string[];
  location: LocationInfo;
  objects: ObjectInfo[];
  recent_events: EventOut[];
  resources: ResourceInfo[];
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "LocationInfo".
 */
export interface LocationInfo {
  discovered_by: string[];
  entrances: number[][];
  id: string;
  name: string;
  props: {
    [k: string]: unknown;
  };
  rect: number[];
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObjectInfo".
 */
export interface ObjectInfo {
  hidden: boolean;
  holder: string | null;
  id: string;
  kind: string;
  known_by: string[];
  location_id: string | null;
  name: string;
  owner: string | null;
  portable: boolean;
  state: {
    [k: string]: unknown;
  };
  x: number | null;
  y: number | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ResourceInfo".
 */
export interface ResourceInfo {
  amount: number;
  cap: number;
  id: string;
  location_id: string;
  requires_tool: string | null;
  resource: string;
  x: number;
  y: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "LocationDiscovered".
 */
export interface LocationDiscovered {
  location: string;
}
/**
 * location_added und location_updated.
 *
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "LocationEvent".
 */
export interface LocationEvent {
  claim?: boolean | null;
  location: {
    [k: string]: unknown;
  };
  reassigned?: {
    [k: string]: number;
  } | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "MapExtended".
 */
export interface MapExtended {
  fill: string;
  from: number[];
  to: number[];
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Moved".
 */
export interface Moved {
  facing: string;
  from: number[];
  remaining?: number;
  to: number[];
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObjectChanged".
 */
export interface ObjectChanged {
  change?: string;
  holder?: string | null;
  id: string;
  kind: string;
  location_id?: string | null;
  name: string;
  state?: {
    [k: string]: unknown;
  };
  x?: number | null;
  y?: number | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObjectCreated".
 */
export interface ObjectCreated {
  cause?: string;
  object: ObjectData;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObjectDiscovered".
 */
export interface ObjectDiscovered {
  object: ObjectData;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ObjectRemoved".
 */
export interface ObjectRemoved {
  cause?: string;
  object: ObjectData;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ParameterChanged".
 */
export interface ParameterChanged {
  group: string;
  rules: {
    [k: string]: unknown;
  };
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "PatchApplied".
 */
export interface PatchApplied {
  counts: {
    [k: string]: number;
  };
  description?: string;
  id: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "PhaseChanged".
 */
export interface PhaseChanged {
  phase: string;
  time: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ProposalAnswered".
 */
export interface ProposalAnswered {
  answered_by: string;
  by: string;
  conversation: number;
  proposal: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Read".
 */
export interface Read {
  content?: unknown[];
  name: string;
  object: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ResetRequest".
 */
export interface ResetRequest {
  confirm?: boolean;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ResourceAdded".
 */
export interface ResourceAdded {
  amount: number;
  cap: number;
  node: string;
  resource: string;
  tile: number[];
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ResourceChanged".
 */
export interface ResourceChanged {
  amount: number;
  cause?: string;
  node: string;
  resource: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Rested".
 */
export interface Rested {
  energy: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SimCommandResult".
 */
export interface SimCommandResult {
  backup: string | null;
  minute: number;
  speed_level: string | null;
  state: string;
  steps: number | null;
  tick_delay_s: number | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SimControl".
 */
export interface SimControl {
  minute: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SimReset".
 */
export interface SimReset {
  backup?: string | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SimStepped".
 */
export interface SimStepped {
  minute: number;
  n: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "Slept".
 */
export interface Slept {
  energy: number;
  minutes: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SpeedChanged".
 */
export interface SpeedChanged {
  level: string;
  tick_delay_s: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SpeedRequest".
 */
export interface SpeedRequest {
  level?: ("slow" | "normal" | "fast" | "max") | null;
  tick_delay_s?: number | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "StartRequest".
 */
export interface StartRequest {
  ticks?: number | null;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "StateSnapshot".
 */
export interface StateSnapshot {
  agents: AgentInfo[];
  clock: ClockInfo;
  locations: LocationInfo[];
  map: MapData;
  objects: ObjectInfo[];
  resources: ResourceInfo[];
  rules: {
    [k: string]: unknown;
  };
  seq: number;
  simulation: SimStatus;
  tile_types: {
    [k: string]: TileTypeInfo;
  };
  weather: WeatherInfo;
  world_name: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "AgentInfo".
 */
export interface AgentInfo {
  action: ActionInfo | null;
  capacity: number;
  facing: string;
  held: string[];
  id: string;
  inventory: {
    [k: string]: number;
  };
  location_id: string;
  name: string;
  needs: {
    [k: string]: number;
  };
  plan_next: string;
  profile: ProfileBrief | null;
  status: string;
  words: {
    [k: string]: string;
  };
  x: number;
  y: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "ClockInfo".
 */
export interface ClockInfo {
  day: number;
  daylight: number;
  minute: number;
  phase: string;
  time: string;
  weekday: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "MapData".
 */
export interface MapData {
  height: number;
  legend: {
    [k: string]: string;
  };
  rows: string[];
  width: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "SimStatus".
 */
export interface SimStatus {
  llm: {
    [k: string]: unknown;
  };
  speed_level: string;
  state: "stopped" | "running" | "paused" | "stepping";
  stats: {
    [k: string]: unknown;
  };
  tick_delay_s: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "TileTypeInfo".
 */
export interface TileTypeInfo {
  char: string | null;
  color: string | null;
  cost: number;
  label: string;
  walkable: boolean;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WeatherInfo".
 */
export interface WeatherInfo {
  kind: string;
  since: number;
  until: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "StatusChanged".
 */
export interface StatusChanged {
  new: string;
  old: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "StepRequest".
 */
export interface StepRequest {
  n?: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "TileChanged".
 */
export interface TileChanged {
  type: string;
  x: number;
  y: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "TileTypeAdded".
 */
export interface TileTypeAdded {
  char?: string | null;
  color?: string | null;
  cost: number;
  id: string;
  label: string;
  walkable: boolean;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "TilesChanged".
 */
export interface TilesChanged {
  cause?: string;
  changes: TileChange[];
  count: number;
  truncated?: boolean;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "TileChange".
 */
export interface TileChange {
  from: string;
  type: string;
  x: number;
  y: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WeatherChanged".
 */
export interface WeatherChanged {
  cause?: string;
  from: string;
  to: string;
  until: number;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WorldTime".
 */
export interface WorldTime {
  day: number;
  daylight: number;
  phase: string;
  time: string;
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsEvent".
 */
export interface WsEvent {
  event: EventOut;
  type: "event";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsEvents".
 */
export interface WsEvents {
  items: EventOut[];
  type: "events";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsHello".
 */
export interface WsHello {
  last_seq?: number | null;
  type: "hello";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsPing".
 */
export interface WsPing {
  type: "ping";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsPong".
 */
export interface WsPong {
  type: "pong";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsResync".
 */
export interface WsResync {
  last_seq?: number | null;
  type: "resync";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsResyncRequired".
 */
export interface WsResyncRequired {
  reason: string;
  type: "resync_required";
}
/**
 * This interface was referenced by `SimulacraApi`'s JSON-Schema
 * via the `definition` "WsSnapshot".
 */
export interface WsSnapshot {
  seq: number;
  state: StateSnapshot;
  type: "snapshot";
}

/** Ereignistyp -> Typ der Daten (`data`). */
export interface EventDataMap {
  "agent.action_started": ActionStarted;
  "agent.action_completed": ActionCompleted;
  "agent.action_failed": ActionProblem;
  "agent.action_rejected": ActionProblem;
  "agent.action_interrupted": ActionInterrupted;
  "agent.moved": Moved;
  "agent.arrived": Arrived;
  "agent.location_changed": LocationChanged;
  "agent.location_discovered": LocationDiscovered;
  "agent.inspected": Inspected;
  "agent.read": Read;
  "agent.fished": Fished;
  "agent.ate": Ate;
  "agent.drank": Drank;
  "agent.slept": Slept;
  "agent.rested": Rested;
  "agent.item_taken": ItemMoved;
  "agent.item_dropped": ItemMoved;
  "agent.item_given": ItemGiven;
  "agent.inventory_changed": InventoryChanged;
  "agent.dialogue": Dialogue;
  "agent.conversation_started": ConversationStarted;
  "agent.conversation_ended": ConversationEnded;
  "agent.proposal_accepted": ProposalAnswered;
  "agent.proposal_declined": ProposalAnswered;
  "agent.decision": Decision;
  "agent.status_changed": StatusChanged;
  "agent.decision_failed": DecisionFailed;
  "agent.memory_created": Record<string, unknown>;
  "agent.memory_retrieved": Record<string, unknown>;
  "agent.goal_changed": Record<string, unknown>;
  "world.object_created": ObjectCreated;
  "world.object_changed": ObjectChanged;
  "world.object_removed": ObjectRemoved;
  "world.object_discovered": ObjectDiscovered;
  "world.resource_changed": ResourceChanged;
  "world.resource_added": ResourceAdded;
  "world.weather_changed": WeatherChanged;
  "world.phase_changed": PhaseChanged;
  "world.day_started": DayStarted;
  "world.time": WorldTime;
  "world.tile_changed": TileChanged;
  "world.tiles_changed": TilesChanged;
  "world.tile_type_added": TileTypeAdded;
  "world.map_extended": MapExtended;
  "world.location_added": LocationEvent;
  "world.location_updated": LocationEvent;
  "world.agent_added": AgentAdded;
  "world.patch_applied": PatchApplied;
  "simulation.started": SimControl;
  "simulation.paused": SimControl;
  "simulation.resumed": SimControl;
  "simulation.stopped": SimControl;
  "simulation.stepped": SimStepped;
  "simulation.reset": SimReset;
  "simulation.parameter_changed": ParameterChanged;
  "simulation.speed_changed": SpeedChanged;
  "simulation.event_injected": Record<string, unknown>;
}

export type EventType = keyof EventDataMap;
export type EventCategory = "world" | "dialogue" | "planning" | "memory" | "system";

/** Kategorie je Ereignistyp (steuert die Unterscheidung im Protokoll). */
export const EVENT_CATEGORY: Record<EventType, EventCategory> = {
  "agent.action_started": "world",
  "agent.action_completed": "world",
  "agent.action_failed": "world",
  "agent.action_rejected": "world",
  "agent.action_interrupted": "world",
  "agent.moved": "world",
  "agent.arrived": "world",
  "agent.location_changed": "world",
  "agent.location_discovered": "world",
  "agent.inspected": "world",
  "agent.read": "world",
  "agent.fished": "world",
  "agent.ate": "world",
  "agent.drank": "world",
  "agent.slept": "world",
  "agent.rested": "world",
  "agent.item_taken": "world",
  "agent.item_dropped": "world",
  "agent.item_given": "world",
  "agent.inventory_changed": "world",
  "agent.dialogue": "dialogue",
  "agent.conversation_started": "dialogue",
  "agent.conversation_ended": "dialogue",
  "agent.proposal_accepted": "dialogue",
  "agent.proposal_declined": "dialogue",
  "agent.decision": "planning",
  "agent.status_changed": "planning",
  "agent.decision_failed": "system",
  "agent.memory_created": "memory",
  "agent.memory_retrieved": "memory",
  "agent.goal_changed": "planning",
  "world.object_created": "world",
  "world.object_changed": "world",
  "world.object_removed": "world",
  "world.object_discovered": "world",
  "world.resource_changed": "world",
  "world.resource_added": "world",
  "world.weather_changed": "world",
  "world.phase_changed": "world",
  "world.day_started": "world",
  "world.time": "system",
  "world.tile_changed": "world",
  "world.tiles_changed": "world",
  "world.tile_type_added": "world",
  "world.map_extended": "world",
  "world.location_added": "world",
  "world.location_updated": "world",
  "world.agent_added": "world",
  "world.patch_applied": "system",
  "simulation.started": "system",
  "simulation.paused": "system",
  "simulation.resumed": "system",
  "simulation.stopped": "system",
  "simulation.stepped": "system",
  "simulation.reset": "system",
  "simulation.parameter_changed": "system",
  "simulation.speed_changed": "system",
  "simulation.event_injected": "system",
};

/** Noch nicht erzeugte, für spätere Pakete vorgesehene Typen. */
export const PLANNED_EVENT_TYPES: EventType[] = ["agent.memory_created", "agent.memory_retrieved", "agent.goal_changed", "simulation.event_injected"];
