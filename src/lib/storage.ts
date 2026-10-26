import { defaultCreatorLinks, initialTasks, welcomeAiMessage } from "../data/presets";
import type {
  ActivityEvent,
  ActivityEventType,
  AiChatMessage,
  CreatorLink,
  ReviewInputs,
  Task,
  View,
} from "../types";
import { normalizeCreatorUrl } from "./format";

export const storageKeys = {
  tasks: "workstation.tasks.v2",
  creatorLinks: "workstation.creator-links",
  aiChat: "workstation.ai-chat.v1",
  ui: "workstation.ui.v1",
  activity: "workstation.activity.v1",
  reviewDrafts: "workstation.daily-review-drafts.v1",
  reviewInputs: "workstation.daily-review-inputs.v1",
} as const;

export function loadStoredTasks(): Task[] {
  try {
    const stored = window.localStorage.getItem(storageKeys.tasks);
    if (!stored) return initialTasks;
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return initialTasks;

    const demoIds = new Set(initialTasks.map((task) => task.id));
    return parsed.flatMap((raw): Task[] => {
      if (!raw || typeof raw !== "object") return [];
      const task = raw as Partial<Task>;
      if (typeof task.id !== "string" || typeof task.title !== "string" || !task.title.trim()) return [];
      return [{
        id: task.id.slice(0, 160),
        title: task.title.trim().slice(0, 500),
        project: typeof task.project === "string" ? task.project.trim().slice(0, 200) : "个人目标",
        done: task.done === true,
        period: task.period === "recent" ? "recent" : "today",
        createdAt: typeof task.createdAt === "string" ? task.createdAt.slice(0, 40) : undefined,
        completedAt: typeof task.completedAt === "string" ? task.completedAt.slice(0, 40) : undefined,
        demo: typeof task.demo === "boolean" ? task.demo : demoIds.has(task.id),
      }];
    });
  } catch {
    return initialTasks;
  }
}

export function loadStoredCreatorLinks(): CreatorLink[] {
  try {
    const stored = window.localStorage.getItem(storageKeys.creatorLinks);
    if (!stored) return defaultCreatorLinks;
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return defaultCreatorLinks;
    const validLinks = parsed.flatMap((raw): CreatorLink[] => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Partial<CreatorLink>;
      const url = normalizeCreatorUrl(item.url);
      if (!url || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim()) return [];
      return [{
        id: item.id.slice(0, 160),
        name: item.name.trim().slice(0, 120),
        url,
        description: typeof item.description === "string" ? item.description.trim().slice(0, 300) : "自定义创作入口",
        builtIn: item.builtIn === true,
      }];
    });
    return validLinks.length ? validLinks : defaultCreatorLinks;
  } catch {
    return defaultCreatorLinks;
  }
}

export function loadAiMessages(): AiChatMessage[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeys.aiChat) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [welcomeAiMessage];
    const messages = parsed.slice(-80).flatMap((item): AiChatMessage[] => {
      if (!item || typeof item !== "object") return [];
      const value = item as Partial<AiChatMessage>;
      if (typeof value.id !== "string" || (value.role !== "user" && value.role !== "assistant") || typeof value.content !== "string") return [];
      return [{ ...value, id: value.id.slice(0, 160), role: value.role, content: value.content.slice(0, 40_000) } as AiChatMessage];
    });
    return messages.length ? messages : [welcomeAiMessage];
  } catch {
    return [welcomeAiMessage];
  }
}

export function loadUiState(): { darkMode?: boolean; view?: View } {
  try {
    return JSON.parse(window.localStorage.getItem(storageKeys.ui) ?? "{}") as { darkMode?: boolean; view?: View };
  } catch {
    return {};
  }
}

export function loadActivityEvents(): ActivityEvent[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeys.activity) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowedTypes = new Set<ActivityEventType>([
      "task_created", "task_completed", "task_reopened", "task_deleted",
      "task_restored", "capture_added", "capture_to_task", "capture_archived", "review_saved",
    ]);
    return parsed.slice(-2000).flatMap((item): ActivityEvent[] => {
      if (!item || typeof item !== "object") return [];
      const value = item as Partial<ActivityEvent>;
      if (
        typeof value.id !== "string" ||
        typeof value.at !== "string" ||
        typeof value.title !== "string" ||
        !allowedTypes.has(value.type as ActivityEventType) ||
        Number.isNaN(Date.parse(value.at))
      ) return [];
      return [{
        id: value.id.slice(0, 160),
        type: value.type as ActivityEventType,
        at: value.at.slice(0, 40),
        title: value.title.slice(0, 500),
        taskId: typeof value.taskId === "string" ? value.taskId.slice(0, 160) : undefined,
      }];
    });
  } catch {
    return [];
  }
}

export function loadReviewDrafts(): Record<string, string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeys.reviewDrafts) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && typeof value === "string")
      .slice(-90)
      .map(([date, value]) => [date, (value as string).slice(0, 16_000)]));
  } catch {
    return {};
  }
}

export function loadReviewInputs(): Record<string, ReviewInputs> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKeys.reviewInputs) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>)
      .flatMap(([date, raw]): Array<[string, ReviewInputs]> => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !raw || typeof raw !== "object" || Array.isArray(raw)) return [];
        const value = raw as Partial<ReviewInputs>;
        return [[date, {
          wins: typeof value.wins === "string" ? value.wins.slice(0, 3000) : "",
          friction: typeof value.friction === "string" ? value.friction.slice(0, 3000) : "",
          tomorrow: typeof value.tomorrow === "string" ? value.tomorrow.slice(0, 3000) : "",
        }]];
      })
      .slice(-90));
  } catch {
    return {};
  }
}
