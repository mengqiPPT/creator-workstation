export type View =
  | "today"
  | "goals"
  | "studio"
  | "analytics"
  | "knowledge"
  | "canvas"
  | "ai";

export type WriteState = "idle" | "writing" | "success" | "error";
export type TaskPeriod = "today" | "recent";
export type AiMode = "agent" | "plan" | "content" | "review" | "knowledge";

export type Task = {
  id: string;
  title: string;
  project: string;
  done: boolean;
  period: TaskPeriod;
  createdAt?: string;
  completedAt?: string;
  demo?: boolean;
};

export type CaptureEntry = {
  text: string;
  createdAt: string;
};

export type ActivityEventType =
  | "task_created"
  | "task_completed"
  | "task_reopened"
  | "task_deleted"
  | "task_restored"
  | "capture_added"
  | "capture_to_task"
  | "capture_archived"
  | "review_saved";

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  at: string;
  title: string;
  taskId?: string;
};

export type ReviewSummary = {
  date: string;
  target: string;
  modifiedAt: string;
};

export type CreatorLink = {
  id: string;
  name: string;
  url: string;
  description: string;
  builtIn: boolean;
};

export type KnowledgeNote = {
  path: string;
  title: string;
  excerpt: string;
  modifiedAt: string;
};

export type KnowledgeSource = KnowledgeNote & {
  id: string;
  score: number;
};

export type VaultStatus = {
  connected: boolean;
  mode: "demo" | "configured";
  source: "demo" | "environment" | "local-config";
  vaultPath: string;
  vaultName: string;
  target: string;
  taskTarget: string;
  reviewFolder: string;
  hasObsidianConfig: boolean;
};

export type TaskSyncResponse = {
  enabled: boolean;
  conflict: boolean;
  tasks: Task[];
  revision: string;
  target: string;
  error?: string;
  code?: string;
};

export type AiStatus = {
  configured: boolean;
  provider?: string;
  providerName?: string;
  baseUrl?: string;
  model?: string;
  keyHint?: string;
  updatedAt?: string;
  lastTestedAt?: string;
};

export type AiUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AgentAction = {
  type: "add_task" | "complete_task" | "rename_task" | "delete_task";
  title: string;
  taskId?: string;
  newTitle?: string;
  period?: TaskPeriod;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: KnowledgeSource[];
  usage?: AiUsage;
  actions?: AgentAction[];
  actionState?: "pending" | "applied" | "dismissed";
};

export type AiProviderPreset = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  keyUrl: string;
  docsUrl: string;
  fit: string;
  setup: string;
  note: string;
};

export type ReviewInputs = { wins: string; friction: string; tomorrow: string };
