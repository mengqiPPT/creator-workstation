import { createContext, useContext, type Dispatch, type RefObject, type SetStateAction } from "react";
import type {
  ActivityEvent,
  AgentAction,
  AiChatMessage,
  AiMode,
  AiStatus,
  CaptureEntry,
  CreatorLink,
  KnowledgeNote,
  KnowledgeSource,
  ReviewInputs,
  ReviewSummary,
  Task,
  TaskPeriod,
  VaultStatus,
  View,
} from "./types";

/** AI 本次对话允许读取的工作站范围。 */
export type AiContextSelection = {
  today: boolean;
  knowledge: boolean;
  inbox: boolean;
};

/** 经过授权后真正会进入模型请求的工作站内容。 */
export type AuthorizedAiContext = {
  tasks: Array<Pick<Task, "id" | "title" | "project" | "done" | "period">>;
  notes: KnowledgeSource[];
  captures: Array<Pick<CaptureEntry, "text" | "createdAt">>;
};

/**
 * 工作站各视图共享的状态与动作集合。
 *
 * 视图组件通过 props 接收它，避免把 3000 行的状态逻辑复制一份；
 * 同时提供 Context，便于后续新增的局部组件按需直接读取。
 */
export type WorkstationStore = {
  // 外壳与导航
  view: View;
  changeView: (nextView: View) => void;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setLinkDialogOpen: Dispatch<SetStateAction<boolean>>;
  todayLabel: string;
  greeting: string;

  // 目标任务
  tasks: Task[];
  trackedTasks: Task[];
  todayTasks: Task[];
  recentTasks: Task[];
  completedCount: number;
  pendingCount: number;
  completion: number;
  hasDemoTasks: boolean;
  newTask: string;
  setNewTask: Dispatch<SetStateAction<string>>;
  newTaskPeriod: TaskPeriod;
  setNewTaskPeriod: Dispatch<SetStateAction<TaskPeriod>>;
  taskError: string;
  setTaskError: Dispatch<SetStateAction<string>>;
  addTask: () => void;
  toggleTask: (taskId: string, checked: boolean) => void;
  requestDeleteTask: (taskId: string) => void;

  // 创作发布
  creatorLinks: CreatorLink[];
  moveCreatorLink: (linkId: string, direction: -1 | 1) => void;
  deleteCreatorLink: (linkId: string) => void;

  // 快速捕获
  capture: string;
  setCapture: Dispatch<SetStateAction<string>>;
  captureError: string;
  setCaptureError: Dispatch<SetStateAction<string>>;
  captures: CaptureEntry[];
  captureTotal: number;
  capturesLoading: boolean;
  openWritePreview: () => void;
  writeMessage: string;

  // 知识库
  vaultStatus: VaultStatus | null;
  vaultError: string;
  knowledgeQuery: string;
  setKnowledgeQuery: Dispatch<SetStateAction<string>>;
  knowledgeNotes: KnowledgeNote[];
  knowledgeLoading: boolean;
  knowledgeError: string;
  knowledgeCalibrationOpen: boolean;
  setKnowledgeCalibrationOpen: Dispatch<SetStateAction<boolean>>;
  searchKnowledge: (query?: string) => Promise<void>;
  resolveCapture: (entry: CaptureEntry, resolution: "task" | "archive") => Promise<void>;
  useCalibrationQuestion: (question: string) => void;

  // 每日复盘
  activityEvents: ActivityEvent[];
  reviewDate: string;
  reviewDraft: string;
  updateReviewDraft: (value: string) => void;
  reviewWins: string;
  reviewFriction: string;
  reviewTomorrow: string;
  updateReviewInput: (field: keyof ReviewInputs, value: string) => void;
  generateReview: () => void;
  reviewSaving: boolean;
  reviewTarget: string;
  reviewMessage: string;
  reviewError: string;
  reviewRevision: string;
  reviewHistory: ReviewSummary[];
  saveDailyReview: () => Promise<void>;

  // AI 私人管家
  aiContext: AiContextSelection;
  setAiContext: Dispatch<SetStateAction<AiContextSelection>>;
  aiStatus: AiStatus | null;
  aiMessages: AiChatMessage[];
  aiGenerating: boolean;
  aiMessage: string;
  setAiMessage: Dispatch<SetStateAction<string>>;
  aiError: string;
  setAiError: Dispatch<SetStateAction<string>>;
  aiDraft: string;
  setAiDraft: Dispatch<SetStateAction<string>>;
  aiMode: AiMode;
  setAiMode: Dispatch<SetStateAction<AiMode>>;
  setAiNewChatOpen: Dispatch<SetStateAction<boolean>>;
  resetAiConversation: () => void;
  buildAuthorizedAiContext: () => AuthorizedAiContext;
  generateWithModel: () => Promise<void>;
  stopAiGeneration: () => void;
  applyAgentActions: (messageId: string, actions: AgentAction[]) => void;
  dismissAgentActions: (messageId: string) => void;
  describeAgentAction: (action: AgentAction) => string;
  openAiConfigDialog: () => void;

  // 通用工具
  obsidianUri: (notePath: string) => string;
  copyText: (value: string, successMessage: string) => Promise<void>;
  aiChatEndRef: RefObject<HTMLDivElement | null>;
  aiComposingRef: RefObject<boolean>;
};

export const WorkstationStoreContext = createContext<WorkstationStore | null>(null);

/** 在 Context 覆盖范围内读取工作站状态；未被 Provider 包裹时给出明确报错。 */
export function useWorkstationStore(): WorkstationStore {
  const store = useContext(WorkstationStoreContext);
  if (!store) {
    throw new Error("useWorkstationStore 必须在 WorkstationStoreContext.Provider 内部使用。");
  }
  return store;
}
