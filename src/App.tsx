import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement, type ReactNode } from "react";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  FluentProvider,
  Input,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Option,
  ProgressBar,
  Textarea,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  Board24Regular,
  BookOpen24Regular,
  Checkmark24Regular,
  Copy24Regular,
  DataTrending24Regular,
  DarkTheme24Regular,
  Delete24Regular,
  Document24Regular,
  Home24Regular,
  Link24Regular,
  Lightbulb24Regular,
  Navigation24Regular,
  Open24Regular,
  Search24Regular,
  Settings24Regular,
  TargetArrow24Regular,
  VideoClip24Regular,
  Wand24Regular,
  WeatherSunny24Regular,
} from "@fluentui/react-icons";
import { CanvasWorkspace } from "./CanvasWorkspace";
import { CommandPalette } from "./CommandPalette";
import { KnowledgeCalibration } from "./KnowledgeCalibration";
import { AssistantGlyph, navItems, viewFromHash } from "./data/navigation";
import { aiProviderPresets, defaultAiProvider } from "./data/presets";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  creatorHostname,
  formatCaptureTime,
  localDateKey,
  normalizeCapture,
  normalizeCreatorUrl,
} from "./lib/format";
import { enterKey, escapeKey, searchShortcutLabel } from "./lib/platform";
import { renderAiMessageContent } from "./lib/markdown";
import {
  loadActivityEvents,
  loadAiMessages,
  loadReviewDrafts,
  loadReviewInputs,
  loadStoredCreatorLinks,
  loadStoredTasks,
  loadUiState,
  storageKeys,
} from "./lib/storage";
import {
  createLocalBackup,
  localBackupSummary,
  parseLocalBackup,
  restoreLocalBackup,
  type WorkstationLocalBackup,
} from "./localBackup";
import { SetupGuide } from "./SetupGuide";
import { workstationDarkTheme, workstationLightTheme } from "./theme";
import type {
  ActivityEvent,
  ActivityEventType,
  AiChatMessage,
  AiMode,
  AiProviderPreset,
  AiStatus,
  AiUsage,
  AgentAction,
  CaptureEntry,
  CreatorLink,
  KnowledgeNote,
  KnowledgeSource,
  ReviewInputs,
  ReviewSummary,
  Task,
  TaskPeriod,
  TaskSyncResponse,
  VaultStatus,
  View,
  WriteState,
} from "./types";
import { WorkstationStoreContext, type WorkstationStore } from "./useWorkstationStore";
import { AiView } from "./views/AiView";
import { AnalyticsView } from "./views/AnalyticsView";
import { GoalsView } from "./views/GoalsView";
import { KnowledgeView } from "./views/KnowledgeView";
import { StudioView } from "./views/StudioView";
import { TodayView } from "./views/TodayView";

export function App() {
  const [view, setView] = useState<View>(viewFromHash);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() =>
    loadUiState().darkMode ?? window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [tasks, setTasks] = useState<Task[]>(loadStoredTasks);
  const tasksRef = useRef(tasks);
  const taskSyncRevisionRef = useRef("");
  const taskSyncEnabledRef = useRef(false);
  const taskSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [newTask, setNewTask] = useState("");
  const [newTaskPeriod, setNewTaskPeriod] = useState<TaskPeriod>("today");
  const [taskError, setTaskError] = useState("");
  const [taskSyncEnabled, setTaskSyncEnabled] = useState(false);
  const [taskSyncConflict, setTaskSyncConflict] = useState(false);
  const [taskSyncTarget, setTaskSyncTarget] = useState("Workstation/Tasks.md");
  const [taskSyncSaving, setTaskSyncSaving] = useState(false);
  const [taskSyncMessage, setTaskSyncMessage] = useState("");
  const [taskSyncError, setTaskSyncError] = useState("");
  const [taskPendingDelete, setTaskPendingDelete] = useState<Task | null>(null);
  const [lastDeletedTask, setLastDeletedTask] = useState<Task | null>(null);
  const [creatorLinks, setCreatorLinks] =
    useState<CreatorLink[]>(loadStoredCreatorLinks);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [platformName, setPlatformName] = useState("");
  const [platformUrl, setPlatformUrl] = useState("");
  const [platformError, setPlatformError] = useState("");
  const [capture, setCapture] = useState("");
  const [captureError, setCaptureError] = useState("");
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);
  const [captureTotal, setCaptureTotal] = useState(0);
  const [capturesLoading, setCapturesLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = useState<WorkstationLocalBackup | null>(null);
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");
  const [vaultPathInput, setVaultPathInput] = useState("");
  const [vaultConfigSaving, setVaultConfigSaving] = useState(false);
  const [vaultConfigMessage, setVaultConfigMessage] = useState("");
  const [vaultConfigError, setVaultConfigError] = useState("");
  const [writeState, setWriteState] = useState<WriteState>("idle");
  const [writeMessage, setWriteMessage] = useState("");
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [vaultError, setVaultError] = useState("");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeNotes, setKnowledgeNotes] = useState<KnowledgeNote[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(true);
  const [knowledgeError, setKnowledgeError] = useState("");
  const [knowledgeCalibrationOpen, setKnowledgeCalibrationOpen] = useState(false);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>(loadActivityEvents);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>(loadReviewDrafts);
  const reviewDate = localDateKey();
  const reviewDraft = reviewDrafts[reviewDate] ?? "";
  const [reviewInputs, setReviewInputs] = useState<Record<string, ReviewInputs>>(loadReviewInputs);
  const reviewWins = reviewInputs[reviewDate]?.wins ?? "";
  const reviewFriction = reviewInputs[reviewDate]?.friction ?? "";
  const reviewTomorrow = reviewInputs[reviewDate]?.tomorrow ?? "";
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewTarget, setReviewTarget] = useState("");
  const [reviewRevision, setReviewRevision] = useState("");
  const [reviewHistory, setReviewHistory] = useState<ReviewSummary[]>([]);
  const [aiMode, setAiMode] = useState<AiMode>("agent");
  const [aiDraft, setAiDraft] = useState("");
  const [aiKnowledgeQuestion, setAiKnowledgeQuestion] = useState("");
  const [aiKnowledgeSources, setAiKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [aiContext, setAiContext] = useState({
    today: true,
    knowledge: true,
    inbox: false,
  });
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [aiClearOpen, setAiClearOpen] = useState(false);
  const [aiNewChatOpen, setAiNewChatOpen] = useState(false);
  const [aiProvider, setAiProvider] = useState(defaultAiProvider.id);
  const [aiProviderName, setAiProviderName] = useState(defaultAiProvider.name);
  const [aiBaseUrl, setAiBaseUrl] = useState(defaultAiProvider.baseUrl);
  const [aiModel, setAiModel] = useState(defaultAiProvider.model);
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiConfigSaving, setAiConfigSaving] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>(loadAiMessages);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const aiComposingRef = useRef(false);
  const aiAbortRef = useRef<AbortController | null>(null);

  const trackedTasks = tasks.filter((task) => !task.demo);
  const completedCount = trackedTasks.filter((task) => task.done).length;
  const pendingCount = trackedTasks.length - completedCount;
  const todayTasks = tasks.filter((task) => task.period === "today");
  const recentTasks = tasks.filter((task) => task.period === "recent");
  const completion = trackedTasks.length ? completedCount / trackedTasks.length : 0;
  const pendingBackupSummary = pendingBackup ? localBackupSummary(pendingBackup) : null;
  const hasDemoTasks = tasks.some((task) => task.demo);
  const normalizedCapture = normalizeCapture(capture);
  const previewMarkdown = normalizedCapture
    ? `- [ ] ${normalizedCapture} <!-- captured: 当前写入时间 -->`
    : "";

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date()),
    [],
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return "早上好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  useEffect(() => {
    tasksRef.current = tasks;
    window.localStorage.setItem(storageKeys.tasks, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    window.localStorage.setItem(
      storageKeys.creatorLinks,
      JSON.stringify(creatorLinks),
    );
  }, [creatorLinks]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.aiChat, JSON.stringify(aiMessages.slice(-80)));
  }, [aiMessages]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.activity, JSON.stringify(activityEvents.slice(-2000)));
  }, [activityEvents]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.reviewDrafts, JSON.stringify(reviewDrafts));
  }, [reviewDrafts]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.reviewInputs, JSON.stringify(reviewInputs));
  }, [reviewInputs]);

  useEffect(() => {
    window.localStorage.setItem(storageKeys.ui, JSON.stringify({ darkMode, view }));
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    document.title = `${navItems.find((item) => item.id === view)?.label ?? "工作台"} · 小黄的工作站`;
  }, [darkMode, view]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/ai/status");
        const result = (await response.json()) as AiStatus & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "模型配置接口没有响应");
        if (active) setAiStatus(result);
      } catch (error) {
        if (active) setAiError(error instanceof Error ? error.message : "模型配置读取失败");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function acceptTaskStore(store: TaskSyncResponse, replaceTasks = true) {
    setTaskSyncTarget(store.target || "Workstation/Tasks.md");
    setTaskSyncConflict(store.conflict);
    setTaskSyncEnabled(store.enabled);
    taskSyncEnabledRef.current = store.enabled && !store.conflict;
    taskSyncRevisionRef.current = store.revision ?? "";

    if (store.enabled && replaceTasks) {
      const vaultTasks = (store.tasks ?? []).map((task) => ({ ...task, demo: false }));
      tasksRef.current = vaultTasks;
      setTasks(vaultTasks);
    }

    if (store.conflict) {
      setTaskSyncError(
        store.error ?? `${store.target} 已存在且不是工作站管理的文件。`,
      );
    } else {
      setTaskSyncError("");
    }
  }

  function queueTaskSync(nextTasks: Task[]) {
    if (!taskSyncEnabledRef.current) return;
    const syncedTasks = nextTasks.filter((task) => !task.demo);

    taskSyncQueueRef.current = taskSyncQueueRef.current.then(async () => {
      if (!taskSyncEnabledRef.current) return;
      setTaskSyncSaving(true);
      try {
        const response = await fetch("/api/vault/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: syncedTasks,
            baseRevision: taskSyncRevisionRef.current,
          }),
        });
        const result = (await response.json()) as TaskSyncResponse;
        if (!response.ok) {
          if (result.code === "TASK_REVISION_CONFLICT") {
            taskSyncEnabledRef.current = false;
            setTaskSyncConflict(true);
          }
          throw new Error(result.error ?? "任务同步失败");
        }

        taskSyncRevisionRef.current = result.revision;
        setTaskSyncError("");
        setTaskSyncMessage(`已同步到 ${result.target}`);
      } catch (error) {
        setTaskSyncError(error instanceof Error ? error.message : "任务同步失败");
      } finally {
        setTaskSyncSaving(false);
      }
    });
  }

  function commitTasks(update: (current: Task[]) => Task[]) {
    const nextTasks = update(tasksRef.current);
    tasksRef.current = nextTasks;
    setTasks(nextTasks);
    queueTaskSync(nextTasks);
  }

  function recordActivity(type: ActivityEventType, title: string, taskId?: string, at = new Date().toISOString()) {
    setActivityEvents((current) => [
      ...current.slice(-1999),
      { id: window.crypto.randomUUID(), type, at, title: title.slice(0, 500), taskId },
    ]);
  }

  function updateReviewDraft(value: string) {
    setReviewDrafts((current) => ({ ...current, [reviewDate]: value.slice(0, 16_000) }));
    setReviewMessage("");
    setReviewError("");
  }

  function updateReviewInput(field: keyof ReviewInputs, value: string) {
    setReviewInputs((current) => ({
      ...current,
      [reviewDate]: {
        wins: current[reviewDate]?.wins ?? "",
        friction: current[reviewDate]?.friction ?? "",
        tomorrow: current[reviewDate]?.tomorrow ?? "",
        [field]: value.slice(0, 3000),
      },
    }));
    setReviewMessage("");
    setReviewError("");
  }

  async function reloadVaultTasks() {
    setTaskSyncSaving(true);
    setTaskSyncError("");
    try {
      const response = await fetch("/api/vault/tasks");
      const result = (await response.json()) as TaskSyncResponse;
      if (!response.ok) throw new Error(result.error ?? "任务文件读取失败");
      acceptTaskStore(result);
      setTaskSyncMessage(
        result.enabled ? `已重新读取 ${result.target}` : "这个 Vault 尚未启用任务同步。",
      );
    } catch (error) {
      setTaskSyncError(error instanceof Error ? error.message : "任务文件读取失败");
    } finally {
      setTaskSyncSaving(false);
    }
  }

  async function enableTaskSync() {
    setTaskSyncSaving(true);
    setTaskSyncError("");
    setTaskSyncMessage("");
    try {
      const response = await fetch("/api/vault/tasks/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tasksRef.current.filter((task) => !task.demo) }),
      });
      const result = (await response.json()) as TaskSyncResponse;
      if (!response.ok) {
        acceptTaskStore(result, false);
        throw new Error(result.error ?? "任务同步启用失败");
      }

      acceptTaskStore(result);
      setTaskSyncMessage(`任务现在由 ${result.target} 保存。`);
    } catch (error) {
      setTaskSyncError(error instanceof Error ? error.message : "任务同步启用失败");
    } finally {
      setTaskSyncSaving(false);
    }
  }

  useEffect(() => {
    const syncView = () => setView(viewFromHash());
    window.addEventListener("hashchange", syncView);
    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      if (isMeta && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      } else if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function focusCaptureInput() {
    const target = document.querySelector<HTMLTextAreaElement>(".capture-panel textarea");
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function focusTaskComposer() {
    const target = document.querySelector<HTMLInputElement>(".goal-composer .fui-Input__input") ??
      document.querySelector<HTMLInputElement>(".goal-composer input");
    if (target) {
      target.focus();
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  useEffect(() => {
    if (view !== "analytics") return;
    let active = true;
    void (async () => {
      try {
        const [reviewResponse, historyResponse] = await Promise.all([
          fetch(`/api/vault/review?date=${encodeURIComponent(reviewDate)}`),
          fetch("/api/vault/reviews"),
        ]);
        const reviewResult = (await reviewResponse.json()) as {
          exists?: boolean;
          content?: string;
          revision?: string;
          target?: string;
          error?: string;
        };
        const historyResult = (await historyResponse.json()) as {
          reviews?: ReviewSummary[];
          error?: string;
        };
        if (!reviewResponse.ok) throw new Error(reviewResult.error ?? "今日复盘读取失败");
        if (!historyResponse.ok) throw new Error(historyResult.error ?? "复盘历史读取失败");
        if (!active) return;
        setReviewTarget(reviewResult.target ?? "");
        setReviewRevision(reviewResult.revision ?? "");
        setReviewHistory(historyResult.reviews ?? []);
        if (reviewResult.exists && reviewResult.content && !reviewDrafts[reviewDate]) {
          setReviewDrafts((current) => ({ ...current, [reviewDate]: reviewResult.content! }));
          setReviewMessage("已读取今天保存过的复盘，可继续编辑。");
        }
      } catch (error) {
        if (active) setReviewError(error instanceof Error ? error.message : "复盘读取失败");
      }
    })();
    return () => { active = false; };
  }, [reviewDate, view]);

  useEffect(() => {
    if (view !== "ai") return;
    aiChatEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [aiMessages, aiGenerating, view]);

  useEffect(() => {
    let active = true;

    async function loadVault() {
      try {
        const [statusResponse, capturesResponse, notesResponse, tasksResponse] =
          await Promise.all([
            fetch("/api/vault/status"),
            fetch("/api/vault/captures"),
            fetch("/api/vault/notes"),
            fetch("/api/vault/tasks"),
          ]);

        if (
          !statusResponse.ok ||
          !capturesResponse.ok ||
          !notesResponse.ok ||
          !tasksResponse.ok
        ) {
          throw new Error("本地 Vault 接口没有响应");
        }

        const status = (await statusResponse.json()) as VaultStatus;
        const captureData = (await capturesResponse.json()) as {
          entries: CaptureEntry[];
          total?: number;
        };
        const notesData = (await notesResponse.json()) as {
          notes: KnowledgeNote[];
        };
        const taskData = (await tasksResponse.json()) as TaskSyncResponse;

        if (active) {
          setVaultStatus(status);
          setCaptures(captureData.entries ?? []);
          setCaptureTotal(captureData.total ?? captureData.entries?.length ?? 0);
          setKnowledgeNotes(notesData.notes ?? []);
          acceptTaskStore(taskData);
          setVaultError("");
          setKnowledgeError("");
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : "Vault 连接失败";
          setVaultError(message);
          setKnowledgeError(message);
        }
      } finally {
        if (active) {
          setCapturesLoading(false);
          setKnowledgeLoading(false);
        }
      }
    }

    void loadVault();
    return () => {
      active = false;
    };
  }, []);

  function changeView(nextView: View) {
    setView(nextView);
    window.location.hash = nextView;
    setMobileNavOpen(false);
    window.setTimeout(() => document.querySelector<HTMLElement>("#main-content")?.focus(), 0);
  }

  function toggleTask(taskId: string, checked: boolean) {
    const task = tasksRef.current.find((item) => item.id === taskId);
    if (!task || task.done === checked) return;
    const changedAt = new Date().toISOString();
    commitTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: checked,
              demo: false,
              createdAt: task.createdAt ?? changedAt,
              completedAt: checked ? changedAt : undefined,
            }
          : task,
      ),
    );
    recordActivity(checked ? "task_completed" : "task_reopened", task.title, task.id, changedAt);
  }

  function addTask() {
    const title = normalizeCapture(newTask);
    if (!title) {
      setTaskError("先写下一个可以执行或观察到结果的任务。");
      return;
    }

    const createdAt = new Date().toISOString();
    const taskId = window.crypto.randomUUID();
    commitTasks((current) => [
      {
        id: taskId,
        title,
        project: "个人目标",
        done: false,
        period: newTaskPeriod,
        createdAt,
        demo: false,
      },
      ...current.filter((task) => !task.demo),
    ]);
    setNewTask("");
    setTaskError("");
    recordActivity("task_created", title, taskId, createdAt);
  }

  function requestDeleteTask(taskId: string) {
    const task = tasksRef.current.find((item) => item.id === taskId);
    if (task) setTaskPendingDelete(task);
  }

  function confirmDeleteTask() {
    if (!taskPendingDelete) return;
    const deleted = taskPendingDelete;
    commitTasks((current) => current.filter((task) => task.id !== deleted.id));
    setLastDeletedTask(deleted);
    setTaskPendingDelete(null);
    recordActivity("task_deleted", deleted.title, deleted.id);
  }

  function undoDeleteTask() {
    if (!lastDeletedTask) return;
    commitTasks((current) => [lastDeletedTask, ...current.filter((task) => task.id !== lastDeletedTask.id)]);
    recordActivity("task_restored", lastDeletedTask.title, lastDeletedTask.id);
    setLastDeletedTask(null);
  }

  function addCreatorLink() {
    const name = platformName.trim();
    let url: URL;

    try {
      url = new URL(platformUrl.trim());
    } catch {
      setPlatformError("请输入完整地址，例如 https://creator.example.com/");
      return;
    }

    if (!name || url.protocol !== "https:") {
      setPlatformError("平台名称不能为空，地址需要使用 https。");
      return;
    }

    setCreatorLinks((current) => [
      ...current,
      {
        id: window.crypto.randomUUID(),
        name,
        url: url.toString(),
        description: "自定义创作后台",
        builtIn: false,
      },
    ]);
    setPlatformName("");
    setPlatformUrl("");
    setPlatformError("");
    setLinkDialogOpen(false);
  }

  function deleteCreatorLink(linkId: string) {
    setCreatorLinks((current) => current.filter((link) => link.id !== linkId));
  }

  function moveCreatorLink(linkId: string, direction: -1 | 1) {
    setCreatorLinks((current) => {
      const index = current.findIndex((link) => link.id === linkId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;

      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[index],
      ];
      return reordered;
    });
  }

  async function searchKnowledge(query = knowledgeQuery) {
    setKnowledgeLoading(true);
    setKnowledgeError("");

    try {
      const response = await fetch(
        `/api/vault/notes?q=${encodeURIComponent(query.trim())}`,
      );
      const result = (await response.json()) as {
        notes?: KnowledgeNote[];
        error?: string;
      };

      if (!response.ok) throw new Error(result.error ?? "知识库搜索失败");
      setKnowledgeNotes(result.notes ?? []);
    } catch (error) {
      setKnowledgeError(error instanceof Error ? error.message : "知识库搜索失败");
    } finally {
      setKnowledgeLoading(false);
    }
  }

  async function configureVault() {
    setVaultConfigSaving(true);
    setVaultConfigError("");
    setVaultConfigMessage("");
    taskSyncEnabledRef.current = false;
    setTaskSyncEnabled(false);

    try {
      const response = await fetch("/api/vault/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath: vaultPathInput.trim() }),
      });
      const result = (await response.json()) as VaultStatus & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Vault 连接失败");

      const [capturesResponse, notesResponse, tasksResponse] = await Promise.all([
        fetch("/api/vault/captures"),
        fetch("/api/vault/notes"),
        fetch("/api/vault/tasks"),
      ]);
      if (!capturesResponse.ok || !notesResponse.ok || !tasksResponse.ok) {
        throw new Error("Vault 已保存，但重新读取内容失败");
      }

      const captureData = (await capturesResponse.json()) as {
        entries: CaptureEntry[];
        total?: number;
      };
      const notesData = (await notesResponse.json()) as {
        notes: KnowledgeNote[];
      };
      const taskData = (await tasksResponse.json()) as TaskSyncResponse;

      setVaultStatus(result);
      setCaptures(captureData.entries ?? []);
      setCaptureTotal(captureData.total ?? captureData.entries?.length ?? 0);
      setKnowledgeNotes(notesData.notes ?? []);
      acceptTaskStore(taskData);
      setVaultError("");
      setKnowledgeError("");
      setVaultPathInput(result.vaultPath);
      setVaultConfigMessage(
        result.hasObsidianConfig
          ? `已连接 ${result.vaultName}，现在可以搜索 Markdown。`
          : "文件夹已经连接，但没有发现 .obsidian 配置目录；请确认它是你的 Vault。",
      );
    } catch (error) {
      setVaultConfigError(error instanceof Error ? error.message : "Vault 连接失败");
    } finally {
      setVaultConfigSaving(false);
    }
  }

  async function chooseVaultFolder() {
    if (!window.workstation?.chooseVaultFolder) {
      setVaultConfigError("当前运行方式不支持文件夹选择，请粘贴完整路径。");
      return;
    }
    const selected = await window.workstation.chooseVaultFolder();
    if (selected) {
      setVaultPathInput(selected);
      setVaultConfigError("");
      setVaultConfigMessage("");
    }
  }

  async function createDesktopShortcut() {
    if (!window.workstation?.createDesktopShortcut) {
      setVaultConfigError("只有桌面应用可以创建快捷方式。");
      return;
    }
    const result = await window.workstation.createDesktopShortcut();
    if (result.ok) setVaultConfigMessage(`桌面快捷方式已创建：${result.path}`);
    else if (!result.canceled) setVaultConfigError("快捷方式创建失败，请检查桌面文件夹权限。");
  }

  function obsidianUri(notePath: string) {
    const params = new URLSearchParams({ file: notePath });
    if (vaultStatus?.vaultName) params.set("vault", vaultStatus.vaultName);
    return `obsidian://open?${params.toString()}`;
  }

  function openWritePreview() {
    if (!normalizedCapture) {
      setCaptureError("先写下一条想法、任务或资料线索。");
      return;
    }

    setCaptureError("");
    setWriteState("idle");
    setWriteMessage("");
    setPreviewOpen(true);
  }

  async function confirmCapture() {
    setWriteState("writing");
    setWriteMessage("");

    try {
      const response = await fetch("/api/vault/append", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: vaultStatus?.target ?? "Inbox/Capture.md",
          text: normalizedCapture,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        text?: string;
        createdAt?: string;
      };

      if (!response.ok || !result.text || !result.createdAt) {
        throw new Error(result.error ?? "写入失败");
      }

      setCaptures((current) => [
        { text: result.text!, createdAt: result.createdAt! },
        ...current,
      ]);
      setCaptureTotal((current) => current + 1);
      setCapture("");
      setWriteState("success");
      setWriteMessage("已追加到 Markdown。原文件保持可直接读取。");
      recordActivity("capture_added", result.text, undefined, result.createdAt);
      void searchKnowledge();
    } catch (error) {
      setWriteState("error");
      setWriteMessage(error instanceof Error ? error.message : "写入失败");
    }
  }

  async function resolveCapture(entry: CaptureEntry, resolution: "task" | "archive") {
    setCaptureError("");
    try {
      const response = await fetch("/api/vault/captures/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entry, resolution }),
      });
      const result = (await response.json()) as { error?: string; total?: number; resolvedAt?: string };
      if (!response.ok) throw new Error(result.error ?? "收件箱处理失败");

      setCaptures((current) => current.filter((item) =>
        item.createdAt !== entry.createdAt || item.text !== entry.text,
      ));
      setCaptureTotal(result.total ?? Math.max(0, captureTotal - 1));
      if (resolution === "task") {
        const taskId = window.crypto.randomUUID();
        const createdAt = new Date().toISOString();
        commitTasks((current) => [{
          id: taskId,
          title: entry.text,
          project: "来自收件箱",
          done: false,
          period: "today",
          createdAt,
          demo: false,
        }, ...current.filter((task) => !task.demo)]);
        recordActivity("capture_to_task", entry.text, taskId, result.resolvedAt ?? createdAt);
        setWriteMessage("已从收件箱移出，并加入今日任务。");
      } else {
        recordActivity("capture_archived", entry.text, undefined, result.resolvedAt);
        setWriteMessage("已归档，不再计入待整理收件箱。");
      }
    } catch (error) {
      setCaptureError(error instanceof Error ? error.message : "收件箱处理失败");
    }
  }

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setWriteMessage(successMessage);
    } catch {
      setWriteMessage("浏览器没有授予剪贴板权限。");
    }
  }

  function downloadLocalBackup() {
    const backup = createLocalBackup(window.localStorage);
    const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `小黄工作站-本机备份-${backup.exportedAt.slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupError("");
    setBackupMessage("本机状态备份已下载；文件不包含 API Key、Vault 路径或 Obsidian 笔记正文。");
  }

  async function chooseLocalBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBackupError("");
    setBackupMessage("");
    try {
      const backup = parseLocalBackup(await file.text());
      setPendingBackup(backup);
      setBackupRestoreOpen(true);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : "备份文件读取失败");
    }
  }

  function confirmLocalBackupRestore() {
    if (!pendingBackup) return;
    restoreLocalBackup(window.localStorage, pendingBackup);
    setBackupRestoreOpen(false);
    window.location.reload();
  }

  function buildReviewDraft() {
    const todayActivities = activityEvents.filter((event) => localDateKey(new Date(event.at)) === reviewDate);
    const completedByEvent = todayActivities.filter((event) => event.type === "task_completed");
    const eventTaskIds = new Set(completedByEvent.map((event) => event.taskId).filter(Boolean));
    const completedFallback = trackedTasks
      .filter((task) => task.done && task.completedAt && localDateKey(new Date(task.completedAt)) === reviewDate)
      .filter((task) => !eventTaskIds.has(task.id))
      .map((task) => ({ title: task.title }));
    const completed = [...completedByEvent, ...completedFallback];
    const created = todayActivities.filter((event) => event.type === "task_created" || event.type === "capture_to_task");
    const todayCaptures = captures.filter((entry) => localDateKey(new Date(entry.createdAt)) === reviewDate);
    const pending = trackedTasks.filter((task) => !task.done);
    const completedText = completed.length
      ? completed.map((item) => `- ${item.title}`).join("\n")
      : "- 今天还没有勾选完成项";
    const createdText = created.length
      ? created.map((item) => `- ${item.title}`).join("\n")
      : "- 今天没有新增任务";
    const pendingText = pending.length
      ? pending.map((task) => `- [ ] ${task.title}`).join("\n")
      : "- 没有遗留事项";
    const captureText = todayCaptures.length
      ? todayCaptures.map((entry) => `- ${entry.text}`).join("\n")
      : "- 今天没有新增捕获";
    const wins = reviewWins.trim() || "（补充：今天最值得保留的成果或做法）";
    const friction = reviewFriction.trim() || "（补充：今天哪里卡住了，原因是什么）";
    const tomorrow = reviewTomorrow.trim() || "（补充：明天开始工作时先做哪一步）";

    return `# 每日复盘 · ${reviewDate}\n\n> 由小黄的工作站整理。客观记录来自今天的操作，主观判断由我自己填写。\n\n## 今日新建\n\n${createdText}\n\n## 今日完成\n\n${completedText}\n\n## 今日捕获\n\n${captureText}\n\n## 仍未完成\n\n${pendingText}\n\n## 我的判断\n\n### 今天最值得保留的成果\n\n${wins}\n\n### 卡点与原因\n\n${friction}\n\n### 明天的第一步\n\n${tomorrow}\n\n---\n\n当前收件箱共有 ${captureTotal} 条未归类内容。`;
  }

  function generateReview() {
    updateReviewDraft(buildReviewDraft());
    setReviewMessage("已按今天的真实操作生成，可以继续编辑再保存。");
  }

  async function saveDailyReview() {
    if (!reviewDraft.trim()) {
      setReviewError("请先生成或填写今日复盘。");
      return;
    }
    if (vaultStatus?.mode !== "configured") {
      setReviewError("请先连接真实 Obsidian Vault，再保存复盘。");
      return;
    }

    setReviewSaving(true);
    setReviewError("");
    setReviewMessage("");
    try {
      const response = await fetch("/api/vault/review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: reviewDate,
          markdown: reviewDraft,
          baseRevision: reviewRevision,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        target?: string;
        revision?: string;
        savedAt?: string;
      };
      if (!response.ok || !result.target || !result.revision) {
        throw new Error(result.error ?? "复盘保存失败");
      }
      setReviewTarget(result.target);
      setReviewRevision(result.revision);
      setReviewMessage(`已安全保存到 ${result.target}`);
      setReviewHistory((current) => [
        { date: reviewDate, target: result.target!, modifiedAt: result.savedAt ?? new Date().toISOString() },
        ...current.filter((item) => item.date !== reviewDate),
      ].slice(0, 60));
      recordActivity("review_saved", `每日复盘 · ${reviewDate}`);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "复盘保存失败");
    } finally {
      setReviewSaving(false);
    }
  }

  function buildAiDraft(mode: AiMode) {
    const pending = trackedTasks.filter((task) => !task.done);

    if (mode === "plan") {
      const lines = pending.length
        ? pending.slice(0, 3).map((task, index) => `${index + 1}. ${task.title}`)
        : ["1. 今天没有待处理任务，先整理收件箱。"];
      return `# 今日规划草稿\n\n${lines.join("\n")}\n\n## 开始前确认\n\n- 哪一项最接近当前目标？\n- 哪一项可以在今天形成可观察结果？`;
    }

    if (mode === "content") {
      const source = captures[0]?.text ?? "请先在知识库捕获一条创作灵感";
      return `# 内容提纲请求\n\n原始灵感：${source}\n\n请帮助我生成：\n\n1. 一句话选题\n2. 目标受众\n3. 开头钩子\n4. 三段核心内容\n5. 结尾行动建议\n6. 发布前检查清单`;
    }

    if (mode === "review") {
      return buildReviewDraft();
    }

    return "";
  }

  function applyAiProvider(providerId: string) {
    const preset = aiProviderPresets.find((item) => item.id === providerId) ?? aiProviderPresets.at(-1)!;
    setAiProvider(preset.id);
    setAiProviderName(preset.name);
    setAiBaseUrl(preset.baseUrl);
    setAiModel(preset.model);
    setAiApiKey("");
    setAiError("");
  }

  function openAiConfigDialog() {
    const matched = aiStatus?.provider
      ? aiProviderPresets.find((item) => item.id === aiStatus.provider)
      : undefined;
    const preset = matched ?? (aiStatus?.configured ? aiProviderPresets.at(-1)! : defaultAiProvider);
    setAiProvider(preset.id);
    setAiProviderName(aiStatus?.providerName ?? preset.name);
    setAiBaseUrl(aiStatus?.baseUrl ?? preset.baseUrl);
    setAiModel(aiStatus?.model ?? preset.model);
    setAiApiKey("");
    setAiError("");
    setAiMessage("");
    setAiConfigOpen(true);
  }

  async function saveAiConfig(testAfterSave = false) {
    setAiConfigSaving(true);
    setAiError("");
    setAiMessage("");
    try {
      const response = await fetch("/api/ai/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          providerName: aiProviderName,
          baseUrl: aiBaseUrl,
          model: aiModel,
          apiKey: aiApiKey,
        }),
      });
      const result = (await response.json()) as AiStatus & { error?: string };
      if (!response.ok || !result.configured) {
        throw new Error(result.error ?? "模型配置保存失败");
      }
      setAiStatus(result);
      setAiApiKey("");
      if (testAfterSave) {
        const testResponse = await fetch("/api/ai/test", { method: "POST" });
        const testResult = (await testResponse.json()) as {
          ok?: boolean;
          preview?: string;
          model?: string;
          lastTestedAt?: string;
          error?: string;
        };
        if (!testResponse.ok || !testResult.ok) {
          throw new Error(`配置已保存，但连接测试失败：${testResult.error ?? "模型没有正常响应"}`);
        }
        setAiStatus({ ...result, lastTestedAt: testResult.lastTestedAt });
        setAiMessage(
          `配置已保存并验证，${result.providerName ?? "模型"} 返回“${testResult.preview ?? "成功"}”。`,
        );
      } else {
        setAiMessage("模型配置已保存在本机，尚未产生模型调用。使用前请完成一次连接测试。");
      }
      setAiConfigOpen(false);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "模型配置保存失败");
    } finally {
      setAiConfigSaving(false);
    }
  }

  async function testAiConnection() {
    setAiTesting(true);
    setAiError("");
    setAiMessage("");
    try {
      const response = await fetch("/api/ai/test", { method: "POST" });
      const result = (await response.json()) as {
        ok?: boolean;
        preview?: string;
        model?: string;
        lastTestedAt?: string;
        error?: string;
      };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "连接测试失败");
      setAiStatus((current) => current ? { ...current, lastTestedAt: result.lastTestedAt } : current);
      setAiMessage(`连接成功，模型返回“${result.preview ?? "成功"}”。测试会产生少量 Token。`);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setAiTesting(false);
    }
  }

  async function clearAiConfig() {
    setAiConfigSaving(true);
    setAiError("");
    try {
      const response = await fetch("/api/ai/config", { method: "DELETE" });
      const result = (await response.json()) as { configured?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "清除配置失败");
      setAiStatus({ configured: false });
      setAiApiKey("");
      setAiClearOpen(false);
      setAiConfigOpen(false);
      setAiMessage("本机保存的模型配置和 API Key 已清除。");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "清除配置失败");
    } finally {
      setAiConfigSaving(false);
    }
  }

  function buildAuthorizedAiContext() {
    return {
      tasks: aiContext.today
        ? trackedTasks.slice(0, 25).map(({ id, title, project, done, period }) => ({ id, title, project, done, period }))
        : [],
      notes: [],
      captures: aiContext.inbox
        ? captures.slice(0, 10).map(({ text, createdAt }) => ({ text, createdAt }))
        : [],
    };
  }

  async function generateWithModel() {
    if (aiGenerating || aiAbortRef.current) return;
    if (!aiStatus?.configured) {
      setAiError("请先配置模型和 API Key。");
      openAiConfigDialog();
      return;
    }
    const requestText = aiDraft.trim() || aiKnowledgeQuestion.trim() || buildAiDraft(aiMode);
    if (!requestText) {
      setAiError("先告诉我你希望我做什么。");
      return;
    }
    if (aiMode === "knowledge" && !aiContext.knowledge) {
      setAiError("请先允许本机检索 Obsidian 知识库。");
      return;
    }
    const userMessage: AiChatMessage = {
      id: window.crypto.randomUUID(),
      role: "user",
      content: requestText,
    };
    const history = aiMessages
      .filter((message) => message.id !== "welcome")
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));
    setAiMessages((current) => [...current, userMessage]);
    setAiGenerating(true);
    setAiError("");
    setAiMessage("");
    try {
      const controller = new AbortController();
      aiAbortRef.current = controller;
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: aiMode,
          request: requestText,
          history,
          context: buildAuthorizedAiContext(),
          useKnowledgeBase: aiContext.knowledge,
        }),
        signal: controller.signal,
      });
      const result = (await response.json()) as {
        ok?: boolean;
        text?: string;
        model?: string;
        usage?: AiUsage;
        grounded?: boolean;
        sources?: KnowledgeSource[];
        actions?: AgentAction[];
        error?: string;
      };
      if (!response.ok || !result.ok || !result.text) {
        throw new Error(result.error ?? "模型生成失败");
      }
      setAiKnowledgeSources(result.sources ?? []);
      setAiMessages((current) => [
        ...current,
        {
          id: window.crypto.randomUUID(),
          role: "assistant",
          content: result.text!,
          sources: result.sources ?? [],
          usage: result.usage,
          actions: result.actions ?? [],
          actionState: result.actions?.length ? "pending" : undefined,
        },
      ]);
      setAiKnowledgeQuestion("");
      setAiDraft("");
      setAiMessage(result.grounded === false
        ? "本机没有检索到足够相关的知识库内容，因此没有让模型猜测。"
        : `${aiStatus.providerName ?? "模型"} 已完成生成，使用模型 ${result.model ?? aiStatus.model}。`);
    } catch (error) {
      setAiError(error instanceof DOMException && error.name === "AbortError"
        ? "已停止本次生成。"
        : error instanceof Error ? error.message : "模型生成失败");
    } finally {
      aiAbortRef.current = null;
      setAiGenerating(false);
    }
  }

  function stopAiGeneration() {
    aiAbortRef.current?.abort();
  }

  function describeAgentAction(action: AgentAction) {
    if (action.type === "add_task") {
      return `新增${action.period === "recent" ? "最近目标" : "今日任务"}：${action.title}`;
    }
    if (action.type === "complete_task") return `标记为完成：${action.title}`;
    if (action.type === "rename_task") return `重命名：${action.title} → ${action.newTitle}`;
    return `删除任务：${action.title}`;
  }

  function applyAgentActions(messageId: string, actions: AgentAction[]) {
    let applied = 0;
    let skipped = 0;
    const pendingEvents: Array<{ type: ActivityEventType; title: string; taskId?: string; at: string }> = [];
    commitTasks((current) => {
      let next = current.filter((task) => !task.demo);
      const additions: Task[] = [];
      for (const action of actions) {
        const normalizedTitle = action.title.trim().toLocaleLowerCase();
        if (action.type === "add_task") {
          if (
            next.some((task) => task.title.trim().toLocaleLowerCase() === normalizedTitle) ||
            additions.some((task) => task.title.trim().toLocaleLowerCase() === normalizedTitle)
          ) {
            skipped += 1;
            continue;
          }
          const taskId = window.crypto.randomUUID();
          const createdAt = new Date().toISOString();
          additions.push({
            id: taskId,
            title: action.title.trim(),
            project: "个人目标",
            done: false,
            period: action.period === "recent" ? "recent" : "today",
            createdAt,
            demo: false,
          });
          pendingEvents.push({ type: "task_created", title: action.title.trim(), taskId, at: createdAt });
          applied += 1;
          continue;
        }

        const taskIndex = next.findIndex((task) =>
          task.id === action.taskId && task.title.trim().toLocaleLowerCase() === normalizedTitle,
        );
        if (taskIndex < 0) {
          skipped += 1;
          continue;
        }
        const target = next[taskIndex];
        const changedAt = new Date().toISOString();
        if (action.type === "complete_task") {
          if (target.done) {
            skipped += 1;
            continue;
          }
          next = next.map((task, index) => index === taskIndex
            ? { ...task, done: true, completedAt: changedAt, demo: false }
            : task);
          pendingEvents.push({ type: "task_completed", title: target.title, taskId: target.id, at: changedAt });
        } else if (action.type === "rename_task" && action.newTitle?.trim()) {
          next = next.map((task, index) => index === taskIndex
            ? { ...task, title: action.newTitle!.trim(), demo: false }
            : task);
        } else if (action.type === "delete_task") {
          next = next.filter((_, index) => index !== taskIndex);
          pendingEvents.push({ type: "task_deleted", title: target.title, taskId: target.id, at: changedAt });
        }
        applied += 1;
      }
      return [...additions, ...next];
    });
    if (pendingEvents.length) {
      setActivityEvents((current) => [
        ...current,
        ...pendingEvents.map((event) => ({ id: window.crypto.randomUUID(), ...event })),
      ].slice(-2000));
    }
    setAiMessages((current) => current.map((message) =>
      message.id === messageId ? { ...message, actionState: "applied" } : message));
    setAiMessage(
      skipped
        ? `已执行 ${applied} 项更改，另有 ${skipped} 项因任务不存在或重复而跳过。`
        : `已执行 ${applied} 项更改，并写回目标任务。`,
    );
    setAiError("");
  }

  function dismissAgentActions(messageId: string) {
    setAiMessages((current) => current.map((message) =>
      message.id === messageId ? { ...message, actionState: "dismissed" } : message));
    setAiMessage("已取消这组更改，工作站没有被修改。");
    setAiError("");
  }

  function useCalibrationQuestion(question: string) {
    setAiMode("knowledge");
    setAiKnowledgeQuestion(question);
    setAiDraft(question);
    setAiKnowledgeSources([]);
    setAiError("");
    setAiMessage("问题已放入 AI 对话。确认允许读取知识库后即可发送。");
    changeView("ai");
  }

  function resetAiConversation() {
    aiAbortRef.current?.abort();
    setAiMessages((current) => current.slice(0, 1));
    setAiMode("agent");
    setAiDraft("");
    setAiKnowledgeQuestion("");
    setAiKnowledgeSources([]);
    setAiError("");
    setAiMessage("");
    setAiNewChatOpen(false);
  }

  // 各视图共享的状态出口：视图组件只读取这里暴露的字段与动作。
  const store: WorkstationStore = {
    view,
    changeView,
    setSettingsOpen,
    setLinkDialogOpen,
    todayLabel,
    greeting,

    tasks,
    trackedTasks,
    todayTasks,
    recentTasks,
    completedCount,
    pendingCount,
    completion,
    hasDemoTasks,
    newTask,
    setNewTask,
    newTaskPeriod,
    setNewTaskPeriod,
    taskError,
    setTaskError,
    addTask,
    toggleTask,
    requestDeleteTask,

    creatorLinks,
    moveCreatorLink,
    deleteCreatorLink,

    capture,
    setCapture,
    captureError,
    setCaptureError,
    captures,
    captureTotal,
    capturesLoading,
    openWritePreview,
    writeMessage,

    vaultStatus,
    vaultError,
    knowledgeQuery,
    setKnowledgeQuery,
    knowledgeNotes,
    knowledgeLoading,
    knowledgeError,
    knowledgeCalibrationOpen,
    setKnowledgeCalibrationOpen,
    searchKnowledge,
    resolveCapture,
    useCalibrationQuestion,

    activityEvents,
    reviewDate,
    reviewDraft,
    updateReviewDraft,
    reviewWins,
    reviewFriction,
    reviewTomorrow,
    updateReviewInput,
    generateReview,
    reviewSaving,
    reviewTarget,
    reviewMessage,
    reviewError,
    reviewRevision,
    reviewHistory,
    saveDailyReview,

    aiContext,
    setAiContext,
    aiStatus,
    aiMessages,
    aiGenerating,
    aiMessage,
    setAiMessage,
    aiError,
    setAiError,
    aiDraft,
    setAiDraft,
    aiMode,
    setAiMode,
    setAiNewChatOpen,
    resetAiConversation,
    buildAuthorizedAiContext,
    generateWithModel,
    stopAiGeneration,
    applyAgentActions,
    dismissAgentActions,
    describeAgentAction,
    openAiConfigDialog,

    obsidianUri,
    copyText,
    aiChatEndRef,
    aiComposingRef,
  };

  const ActiveView = {
    today: () => <TodayView store={store} />,
    goals: () => <GoalsView store={store} />,
    studio: () => <StudioView store={store} />,
    analytics: () => <AnalyticsView store={store} />,
    knowledge: () => <KnowledgeView store={store} />,
    canvas: () => (
      <CanvasWorkspace
        tasks={trackedTasks}
        notes={knowledgeNotes}
        darkMode={darkMode}
      />
    ),
    ai: () => <AiView store={store} />,
  }[view];

  return (
    <FluentProvider theme={darkMode ? workstationDarkTheme : workstationLightTheme}>
      <WorkstationStoreContext.Provider value={store}>
      <div className={`app-shell view-${view}${darkMode ? " dark" : ""}`}>
        <aside className={mobileNavOpen ? "sidebar open" : "sidebar"}>
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              黄
            </div>
            <div>
              <strong>小黄的工作站</strong>
              <span>个人上下文入口</span>
            </div>
          </div>

          <nav aria-label="主要导航">
            {navItems.map((item) => (
              <Button
                key={item.id}
                appearance={view === item.id ? "secondary" : "subtle"}
                icon={item.icon}
                className={view === item.id ? "nav-button active" : "nav-button"}
                aria-current={view === item.id ? "page" : undefined}
                title={item.label}
                onClick={() => changeView(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="vault-card" onClick={() => setSettingsOpen(true)} title="知识库与工作站设置">
              <span className="vault-card-icon" aria-hidden="true">
                <Document24Regular />
              </span>
              <span>
                <strong>
                  {vaultStatus?.mode === "configured" ? "真实 Vault" : "演示知识库"}
                </strong>
                <small>
                  {vaultError
                    ? "连接失败"
                    : vaultStatus
                      ? "Markdown 已就绪"
                      : "正在检查"}
                </small>
              </span>
              <Settings24Regular aria-hidden="true" />
            </button>
            <Button
              className="sidebar-theme"
              appearance="subtle"
              icon={darkMode ? <WeatherSunny24Regular /> : <DarkTheme24Regular />}
              aria-label={darkMode ? "切换浅色" : "切换深色"}
              title={darkMode ? "切换浅色" : "切换深色"}
              onClick={() => setDarkMode((current) => !current)}
            />
          </div>
        </aside>

        {mobileNavOpen ? (
          <button
            className="nav-backdrop"
            aria-label="关闭导航"
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}

        <div className="app-main">
          <header className="topbar">
            <Button
              className="mobile-menu"
              appearance="subtle"
              icon={<Navigation24Regular />}
              aria-label="打开导航"
              title="打开导航"
              onClick={() => setMobileNavOpen(true)}
            />
            <div className="topbar-title">
              <strong>{navItems.find((item) => item.id === view)?.label}</strong>
              <span>创作者工作站</span>
            </div>
            <div className="topbar-actions">
              <button
                className="topbar-search"
                onClick={() => setPaletteOpen(true)}
                title={`搜索任务、笔记、动作（${searchShortcutLabel}）`}
                aria-label="打开命令面板"
              >
                <Search24Regular aria-hidden="true" />
                <span>搜索</span>
                <kbd>{searchShortcutLabel}</kbd>
              </button>
              <Button
                appearance="subtle"
                icon={<Settings24Regular />}
                onClick={() => setSettingsOpen(true)}
              >
                {vaultStatus?.mode === "configured" ? "已连接 Vault" : "连接 Obsidian"}
              </Button>
              <Button
                appearance="subtle"
                icon={darkMode ? <WeatherSunny24Regular /> : <DarkTheme24Regular />}
                aria-label={darkMode ? "切换浅色" : "切换深色"}
                title={darkMode ? "切换浅色" : "切换深色"}
                onClick={() => setDarkMode((current) => !current)}
              />
            </div>
          </header>

          <main
            id="main-content"
            tabIndex={-1}
            className={
              view === "canvas"
                ? "content-area canvas-content-area"
                : view === "ai"
                  ? "content-area agent-content-area"
                  : "content-area"
            }
          >
            <ErrorBoundary key={view} scope="view">
              <ActiveView />
            </ErrorBoundary>
          </main>
        </div>

        <nav className="mobile-bottom-nav" aria-label="移动端主要导航">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              onClick={() => changeView(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {lastDeletedTask ? (
          <div className="undo-toast" role="status">
            <span>已删除“{lastDeletedTask.title}”</span>
            <Button appearance="subtle" size="small" onClick={undoDeleteTask}>撤销</Button>
            <Button appearance="subtle" size="small" onClick={() => setLastDeletedTask(null)}>关闭</Button>
          </div>
        ) : null}

        <Dialog open={Boolean(taskPendingDelete)} onOpenChange={(_, data) => !data.open && setTaskPendingDelete(null)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>删除这项任务？</DialogTitle>
              <DialogContent>
                “{taskPendingDelete?.title}”会从工作站移除{taskSyncEnabled ? "，并同步到 Obsidian" : ""}。删除后仍可立即撤销。
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setTaskPendingDelete(null)}>取消</Button>
                <Button appearance="primary" onClick={confirmDeleteTask}>确认删除</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog
          open={previewOpen}
          onOpenChange={(_, data) => {
            setPreviewOpen(data.open);
            if (!data.open) {
              setWriteState("idle");
              setWriteMessage("");
            }
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>确认写入 Obsidian</DialogTitle>
              <DialogContent>
                <div className="write-summary">
                  <span>目标文件</span>
                  <code>{vaultStatus?.target ?? "Inbox/Capture.md"}</code>
                </div>
                <div className="markdown-preview">
                  <span>将追加以下 Markdown</span>
                  <pre>{previewMarkdown}</pre>
                </div>
                {writeMessage ? (
                  <MessageBar intent={writeState === "error" ? "error" : "success"}>
                    <MessageBarBody>{writeMessage}</MessageBarBody>
                  </MessageBar>
                ) : null}
              </DialogContent>
              <DialogActions>
                {writeState === "success" ? (
                  <Button appearance="primary" onClick={() => setPreviewOpen(false)}>
                    完成
                  </Button>
                ) : (
                  <>
                    <Button
                      icon={<Copy24Regular />}
                      onClick={() =>
                        void copyText(previewMarkdown, "Markdown 已复制。")
                      }
                    >
                      复制
                    </Button>
                    <Button onClick={() => setPreviewOpen(false)}>取消</Button>
                    <Button
                      appearance="primary"
                      disabled={writeState === "writing"}
                      onClick={() => void confirmCapture()}
                    >
                      {writeState === "writing" ? "正在写入" : "确认追加"}
                    </Button>
                  </>
                )}
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog
          open={linkDialogOpen}
          onOpenChange={(_, data) => {
            setLinkDialogOpen(data.open);
            if (!data.open) setPlatformError("");
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>添加创作者后台</DialogTitle>
              <DialogContent>
                <div className="settings-stack">
                  <Field label="平台或工具名称">
                    <Input
                      value={platformName}
                      onChange={(_, data) => setPlatformName(data.value)}
                      placeholder="例如：知乎创作中心"
                    />
                  </Field>
                  <Field
                    label="后台地址"
                    validationMessage={platformError || undefined}
                    validationState={platformError ? "error" : "none"}
                  >
                    <Input
                      value={platformUrl}
                      onChange={(_, data) => {
                        setPlatformUrl(data.value);
                        if (platformError) setPlatformError("");
                      }}
                      placeholder="https://"
                    />
                  </Field>
                  <p className="dialog-helper">
                    自定义入口只保存在当前浏览器，不会写进 Vault 或上传到外部服务。
                  </p>
                </div>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setLinkDialogOpen(false)}>取消</Button>
                <Button appearance="primary" onClick={addCreatorLink}>
                  保存入口
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog
          open={aiConfigOpen}
          onOpenChange={(_, data) => {
            setAiConfigOpen(data.open);
            if (!data.open) setAiApiKey("");
          }}
        >
          <DialogSurface className="ai-config-surface">
            <DialogBody>
              <DialogTitle>配置自己的 AI 模型</DialogTitle>
              <DialogContent>
                <div className="settings-stack">
                  <MessageBar intent="info">
                    <MessageBarBody>
                      API Key 保存在本机的 .workstation.secrets.json 中，并已从 Git 忽略。
                      浏览器只会看到脱敏状态，不会读取完整密钥。
                    </MessageBarBody>
                  </MessageBar>
                  <Field label="模型服务">
                    <Dropdown
                      value={aiProviderName}
                      selectedOptions={[aiProvider]}
                      onOptionSelect={(_, data) => applyAiProvider(String(data.optionValue))}
                    >
                      {aiProviderPresets.map((provider) => (
                        <Option key={provider.id} value={provider.id} text={provider.name}>
                          {provider.name}
                        </Option>
                      ))}
                    </Dropdown>
                  </Field>
                  <div className="ai-config-note">
                    <div className="ai-config-guidance">
                      <strong>{aiProviderPresets.find((item) => item.id === aiProvider)?.fit}</strong>
                      <p>{aiProviderPresets.find((item) => item.id === aiProvider)?.setup}</p>
                      <p>{aiProviderPresets.find((item) => item.id === aiProvider)?.note}</p>
                    </div>
                    <div className="ai-config-links">
                      {aiProviderPresets.find((item) => item.id === aiProvider)?.keyUrl ? (
                        <a
                          href={aiProviderPresets.find((item) => item.id === aiProvider)?.keyUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          申请 API Key
                          <Open24Regular aria-hidden="true" />
                        </a>
                      ) : null}
                      {aiProviderPresets.find((item) => item.id === aiProvider)?.docsUrl ? (
                        <a
                          href={aiProviderPresets.find((item) => item.id === aiProvider)?.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          官方接入文档
                          <Open24Regular aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  {aiProvider === "custom" ? (
                    <Field label="显示名称">
                      <Input
                        value={aiProviderName}
                        onChange={(_, data) => setAiProviderName(data.value)}
                        placeholder="例如：本机 Ollama"
                      />
                    </Field>
                  ) : null}
                  <Field
                    label="API 基础地址"
                    hint={aiProvider === "qwen" ? "从创建 API Key 后的弹窗复制 API Host，地址中应包含 Workspace ID" : undefined}
                  >
                    <Input
                      value={aiBaseUrl}
                      onChange={(_, data) => setAiBaseUrl(data.value)}
                      placeholder={aiProvider === "qwen" ? "https://你的WorkspaceId.cn-beijing.maas.aliyuncs.com/compatible-mode/v1" : "https://example.com/v1"}
                    />
                  </Field>
                  <Field label="模型 ID">
                    <Input
                      value={aiModel}
                      onChange={(_, data) => setAiModel(data.value)}
                      placeholder="从供应商控制台复制模型 ID"
                    />
                  </Field>
                  <Field
                    label="API Key"
                    hint={aiStatus?.configured ? `${aiStatus.keyHint}，留空则保留原 Key` : "只保存到本机服务配置文件"}
                  >
                    <Input
                      type="password"
                      value={aiApiKey}
                      autoComplete="off"
                      onChange={(_, data) => setAiApiKey(data.value)}
                      placeholder={aiStatus?.configured ? "留空以保留原 Key" : "粘贴你申请的 API Key"}
                    />
                  </Field>
                  {aiError ? (
                    <MessageBar intent="error">
                      <MessageBarBody>{aiError}</MessageBarBody>
                    </MessageBar>
                  ) : null}
                  <p className="dialog-helper">
                    “仅保存”不会调用模型；“保存并测试”会发送一句最小测试文本，供应商可能收取少量 Token 费用。
                  </p>
                </div>
              </DialogContent>
              <DialogActions>
                {aiStatus?.configured ? (
                  <Button
                    appearance="subtle"
                    icon={<Delete24Regular />}
                    onClick={() => {
                      setAiConfigOpen(false);
                      setAiClearOpen(true);
                    }}
                  >
                    清除配置
                  </Button>
                ) : null}
                <Button onClick={() => setAiConfigOpen(false)}>取消</Button>
                <Button
                  disabled={
                    aiConfigSaving ||
                    !aiProviderName.trim() ||
                    !aiBaseUrl.trim() ||
                    !aiModel.trim() ||
                    (!aiStatus?.configured && !aiApiKey.trim())
                  }
                  onClick={() => void saveAiConfig(false)}
                >
                  {aiConfigSaving ? "正在处理" : "仅保存"}
                </Button>
                <Button
                  appearance="primary"
                  disabled={
                    aiConfigSaving ||
                    !aiProviderName.trim() ||
                    !aiBaseUrl.trim() ||
                    !aiModel.trim() ||
                    (!aiStatus?.configured && !aiApiKey.trim())
                  }
                  onClick={() => void saveAiConfig(true)}
                >
                  {aiConfigSaving ? "正在处理" : "保存并测试"}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog open={aiClearOpen} onOpenChange={(_, data) => setAiClearOpen(data.open)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>清除模型配置？</DialogTitle>
              <DialogContent>
                这会删除本机保存的供应商地址、模型 ID 和 API Key。操作完成后无法从工作站恢复。
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAiClearOpen(false)}>取消</Button>
                <Button
                  appearance="primary"
                  disabled={aiConfigSaving}
                  onClick={() => void clearAiConfig()}
                >
                  {aiConfigSaving ? "正在清除" : "确认清除"}
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog open={aiNewChatOpen} onOpenChange={(_, data) => setAiNewChatOpen(data.open)}>
          <DialogSurface>
            <DialogBody>
              <DialogTitle>开始一段新对话？</DialogTitle>
              <DialogContent>
                当前对话会从界面和本机记录中清除。任务、画布和知识库不会受到影响。
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setAiNewChatOpen(false)}>继续当前对话</Button>
                <Button appearance="primary" onClick={resetAiConversation}>开始新对话</Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog
          open={settingsOpen}
          onOpenChange={(_, data) => {
            setSettingsOpen(data.open);
            if (data.open) {
              setVaultPathInput(
                vaultStatus?.mode === "configured" ? vaultStatus.vaultPath : "",
              );
              setVaultConfigError("");
              setVaultConfigMessage("");
            }
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>Obsidian 连接</DialogTitle>
              <DialogContent>
                <div className="settings-stack">
                  <MessageBar
                    intent={
                      vaultError
                        ? "warning"
                        : vaultStatus?.mode === "configured"
                          ? "success"
                          : "info"
                    }
                  >
                    <MessageBarBody>
                      <MessageBarTitle>
                        {vaultStatus?.mode === "configured"
                          ? "已连接指定 Vault"
                          : "当前使用 Demo Vault"}
                      </MessageBarTitle>
                      {vaultError || vaultStatus?.vaultPath || "正在读取连接状态"}
                    </MessageBarBody>
                  </MessageBar>
                  <div className="settings-block">
                    <h3>连接真实 Vault</h3>
                    {vaultStatus?.source === "environment" ? (
                      <p>
                        当前路径由 <code>WORKSTATION_VAULT_PATH</code> 环境变量管理。
                        如需在界面中修改，请先移除该环境变量并重新启动工作站。
                      </p>
                    ) : (
                      <>
                        <p>粘贴 Obsidian Vault 的完整文件夹路径，保存后立即切换。</p>
                        <Field
                          label="Vault 文件夹路径"
                          validationMessage={vaultConfigError || undefined}
                          validationState={vaultConfigError ? "error" : "none"}
                        >
                          <Input
                            value={vaultPathInput}
                            onChange={(_, data) => {
                              setVaultPathInput(data.value);
                              if (vaultConfigError) setVaultConfigError("");
                              if (vaultConfigMessage) setVaultConfigMessage("");
                            }}
                            placeholder="例如：D:\\Obsidian\\我的知识库"
                          />
                        </Field>
                        <div className="settings-inline-actions">
                          {window.workstation?.chooseVaultFolder ? (
                            <Button onClick={() => void chooseVaultFolder()}>选择文件夹</Button>
                          ) : null}
                          <Button
                            appearance="primary"
                            disabled={vaultConfigSaving || !vaultPathInput.trim()}
                            onClick={() => void configureVault()}
                          >
                            {vaultConfigSaving ? "正在检查" : "连接这个 Vault"}
                          </Button>
                        </div>
                        <p className="dialog-helper">
                          路径只保存在本机的 .workstation.local.json，并已从 Git 中忽略。
                        </p>
                      </>
                    )}
                  </div>
                  {vaultConfigMessage ? (
                    <MessageBar
                      intent={vaultStatus?.hasObsidianConfig ? "success" : "warning"}
                    >
                      <MessageBarBody>{vaultConfigMessage}</MessageBarBody>
                    </MessageBar>
                  ) : null}
                  <div className="settings-block task-sync-block">
                    <div className="settings-block-heading">
                      <div>
                        <h3>目标任务保存位置</h3>
                        <p>
                          {taskSyncEnabled
                            ? `已启用 ${taskSyncTarget}`
                            : "默认保存在当前浏览器；可主动启用 Obsidian Markdown 同步。"}
                        </p>
                      </div>
                      <Badge
                        appearance="tint"
                        color={
                          taskSyncConflict
                            ? "warning"
                            : taskSyncEnabled
                              ? "success"
                              : "informative"
                        }
                      >
                        {taskSyncConflict
                          ? "同步已暂停"
                          : taskSyncEnabled
                            ? "Obsidian 已同步"
                            : "仅本机"}
                      </Badge>
                    </div>
                    <p className="dialog-helper">
                      工作站只会管理这一份专用文件；如果同名文件已存在且没有管理标记，会停止并提示冲突。
                    </p>
                    <div className="settings-inline-actions">
                      {taskSyncEnabled || taskSyncConflict ? (
                        <Button
                          disabled={taskSyncSaving}
                          onClick={() => void reloadVaultTasks()}
                        >
                          {taskSyncSaving ? "正在读取" : "重新读取 Obsidian"}
                        </Button>
                      ) : (
                        <Button
                          appearance="primary"
                          disabled={taskSyncSaving || Boolean(vaultError)}
                          onClick={() => void enableTaskSync()}
                        >
                          {taskSyncSaving ? "正在启用" : "启用任务同步"}
                        </Button>
                      )}
                    </div>
                  </div>
                  {taskSyncError || taskSyncMessage ? (
                    <MessageBar intent={taskSyncError ? "warning" : "success"}>
                      <MessageBarBody>{taskSyncError || taskSyncMessage}</MessageBarBody>
                    </MessageBar>
                  ) : null}
                  <div className="settings-block">
                    <h3>本机数据备份</h3>
                    <p>
                      备份任务、创作入口、无限画布、AI 对话、活动记录、每日复盘草稿和检索校准。
                      不包含 API Key、Vault 路径或 Obsidian 笔记正文。
                    </p>
                    <div className="settings-inline-actions">
                      <Button icon={<ArrowDownload24Regular />} onClick={downloadLocalBackup}>
                        导出备份
                      </Button>
                      <Button icon={<ArrowUpload24Regular />} onClick={() => backupInputRef.current?.click()}>
                        导入备份
                      </Button>
                      <input
                        ref={backupInputRef}
                        className="canvas-file-input"
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => void chooseLocalBackup(event)}
                      />
                    </div>
                    {backupError || backupMessage ? (
                      <MessageBar intent={backupError ? "error" : "success"}>
                        <MessageBarBody>{backupError || backupMessage}</MessageBarBody>
                      </MessageBar>
                    ) : null}
                  </div>
                  {window.workstation?.createDesktopShortcut ? (
                    <div className="settings-block">
                      <h3>桌面入口</h3>
                      <p>如果安装后没有看到快捷方式，可以在这里重新创建，不需要重装。</p>
                      <Button onClick={() => void createDesktopShortcut()}>创建桌面快捷方式</Button>
                    </div>
                  ) : null}
                  <div className="settings-block">
                    <h3>当前安全边界</h3>
                    <ul>
                      <li>快速捕获只允许操作 {vaultStatus?.target ?? "连接配置指定的捕获文件"}。</li>
                      <li>任务同步仅在主动启用后管理 {vaultStatus?.taskTarget ?? taskSyncTarget}。</li>
                      <li>每日复盘只写入 {vaultStatus?.reviewFolder ?? "连接配置指定的复盘目录"}，并阻止覆盖非工作站文件或外部新修改。</li>
                      <li>写入前展示目标文件和 Markdown。</li>
                      <li>知识搜索只读索引 Markdown，不读取隐藏目录。</li>
                      <li>不会删除或批量改写其他笔记。</li>
                    </ul>
                  </div>
                </div>
              </DialogContent>
              <DialogActions>
                <Button appearance="primary" onClick={() => setSettingsOpen(false)}>
                  知道了
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <Dialog
          open={backupRestoreOpen}
          onOpenChange={(_, data) => {
            setBackupRestoreOpen(data.open);
            if (!data.open) setPendingBackup(null);
          }}
        >
          <DialogSurface>
            <DialogBody>
              <DialogTitle>恢复这份本机备份？</DialogTitle>
              <DialogContent>
                <div className="settings-stack">
                  <p>
                    备份时间：
                    {pendingBackupSummary
                      ? new Date(pendingBackupSummary.exportedAt).toLocaleString("zh-CN")
                      : "未知"}
                  </p>
                  <p>包含 {pendingBackupSummary?.itemCount ?? 0} 类本机数据。</p>
                  <MessageBar intent="warning">
                    <MessageBarBody>
                      恢复会替换当前浏览器中的工作站状态，然后重新载入页面。
                      不会修改 Obsidian，也不会更改模型 API Key。
                    </MessageBarBody>
                  </MessageBar>
                </div>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setBackupRestoreOpen(false)}>取消</Button>
                <Button appearance="primary" onClick={confirmLocalBackupRestore}>
                  确认恢复并重新载入
                </Button>
              </DialogActions>
            </DialogBody>
          </DialogSurface>
        </Dialog>

        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          changeView={changeView}
          setSettingsOpen={setSettingsOpen}
          setLinkDialogOpen={setLinkDialogOpen}
          setDarkMode={setDarkMode}
          openAiConfig={openAiConfigDialog}
          downloadBackup={downloadLocalBackup}
          focusCapture={focusCaptureInput}
          focusTask={focusTaskComposer}
          tasks={trackedTasks}
          notes={knowledgeNotes}
          darkMode={darkMode}
        />
      </div>
      </WorkstationStoreContext.Provider>
    </FluentProvider>
  );
}
