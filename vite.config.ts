import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const defaultCaptureTarget = "Inbox/Capture.md";
const defaultTaskTarget = "Workstation/Tasks.md";
const taskMarker = "<!-- workstation-managed-tasks:v1 -->";
const defaultReviewFolder = "Workstation/Reviews";
const reviewMarker = "<!-- workstation-daily-review:v1 -->";
const maxIndexedNotes = 500;
const applicationRoot = process.env.WORKSTATION_APP_ROOT
  ? path.resolve(process.env.WORKSTATION_APP_ROOT)
  : process.cwd();
const workstationDataRoot = process.env.WORKSTATION_DATA_DIR
  ? path.resolve(process.env.WORKSTATION_DATA_DIR)
  : process.cwd();
const demoVaultRoot = path.join(applicationRoot, "demo-vault");
const localConfigPath = path.join(workstationDataRoot, ".workstation.local.json");
const localSecretsPath = path.join(workstationDataRoot, ".workstation.secrets.json");
const mediaRoot = path.join(workstationDataRoot, "media");
const desktopSessionToken = process.env.WORKSTATION_SESSION_TOKEN ?? "";

type AiConfig = {
  provider: string;
  providerName: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  updatedAt: string;
  lastTestedAt?: string;
};

type StoredAiConfig = Omit<AiConfig, "apiKey"> & {
  apiKey?: string;
  apiKeyEncrypted?: string;
  encryption?: "electron-safe-storage-v1";
};

type AiContext = {
  tasks: Array<{ id: string; title: string; project: string; done: boolean; period: string }>;
  notes: Array<{ title: string; path: string; excerpt: string }>;
  captures: Array<{ text: string; createdAt: string }>;
};

type AiAgentAction = {
  type: "add_task" | "complete_task" | "rename_task" | "delete_task";
  title: string;
  taskId?: string;
  newTitle?: string;
  period?: "today" | "recent";
};

type CanvasAiProposalNode = {
  kind: "note" | "task" | "knowledge" | "link";
  title: string;
  body: string;
  parentTitle?: string;
};

type KnowledgeSource = {
  id: string;
  path: string;
  title: string;
  excerpt: string;
  modifiedAt: string;
  score: number;
};

type VaultConnection = {
  root: string;
  mode: "demo" | "configured";
  source: "demo" | "environment" | "local-config";
  captureTarget: string;
  taskTarget: string;
  reviewFolder: string;
};

function normalizeVaultMarkdownTarget(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;

  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/");
  if (
    !normalized.toLowerCase().endsWith(".md") ||
    path.isAbsolute(value) ||
    /^[a-zA-Z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("工作站写入文件必须是 Vault 内的 Markdown 相对路径");
  }

  return normalized;
}

function normalizeVaultDirectory(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;

  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/");
  if (
    path.isAbsolute(value) ||
    /^[a-zA-Z]:/.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error("复盘目录必须是 Vault 内的相对路径");
  }

  return normalized;
}

async function suggestManagedTargets(vaultRoot: string) {
  const systemFolder = await fs.stat(path.join(vaultRoot, "_系统")).catch(() => null);
  if (systemFolder?.isDirectory()) {
    return {
      taskTarget: "_系统/工作站/任务.md",
      reviewFolder: "_系统/工作站/复盘",
    };
  }

  return {
    taskTarget: defaultTaskTarget,
    reviewFolder: defaultReviewFolder,
  };
}

async function suggestCaptureTarget(vaultRoot: string) {
  const chineseInbox = await fs
    .stat(path.join(vaultRoot, "00_收件箱"))
    .catch(() => null);
  if (chineseInbox?.isDirectory()) return "00_收件箱/工作站捕获.md";

  const englishInbox = await fs.stat(path.join(vaultRoot, "Inbox")).catch(() => null);
  if (englishInbox?.isDirectory()) return defaultCaptureTarget;

  return defaultCaptureTarget;
}

async function getVaultConnection(): Promise<VaultConnection> {
  if (process.env.WORKSTATION_VAULT_PATH) {
    const root = path.resolve(process.env.WORKSTATION_VAULT_PATH);
    const managedTargets = await suggestManagedTargets(root);
    return {
      root,
      mode: "configured",
      source: "environment",
      captureTarget: normalizeVaultMarkdownTarget(
        process.env.WORKSTATION_CAPTURE_TARGET,
        await suggestCaptureTarget(root),
      ),
      taskTarget: normalizeVaultMarkdownTarget(
        process.env.WORKSTATION_TASK_TARGET,
        managedTargets.taskTarget,
      ),
      reviewFolder: normalizeVaultDirectory(
        process.env.WORKSTATION_REVIEW_FOLDER,
        managedTargets.reviewFolder,
      ),
    };
  }

  try {
    const config = JSON.parse(await fs.readFile(localConfigPath, "utf8")) as {
      vaultPath?: unknown;
      captureTarget?: unknown;
      taskTarget?: unknown;
      reviewFolder?: unknown;
    };
    if (typeof config.vaultPath === "string" && config.vaultPath.trim()) {
      const root = path.resolve(config.vaultPath.trim());
      const managedTargets = await suggestManagedTargets(root);
      return {
        root,
        mode: "configured",
        source: "local-config",
        captureTarget: normalizeVaultMarkdownTarget(
          config.captureTarget,
          await suggestCaptureTarget(root),
        ),
        taskTarget: normalizeVaultMarkdownTarget(config.taskTarget, managedTargets.taskTarget),
        reviewFolder: normalizeVaultDirectory(config.reviewFolder, managedTargets.reviewFolder),
      };
    }
  } catch {
    // Missing or invalid local configuration falls back to the bundled demo Vault.
  }

  return {
    root: demoVaultRoot,
    mode: "demo",
    source: "demo",
    captureTarget: defaultCaptureTarget,
    taskTarget: defaultTaskTarget,
    reviewFolder: defaultReviewFolder,
  };
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: Record<string, unknown>,
) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function normalizeShortText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new Error(`${label}格式不正确`);
  const normalized = value.trim().replace(/[\r\n\0]+/g, " ").slice(0, maxLength);
  if (!normalized) throw new Error(`请填写${label}`);
  return normalized;
}

function normalizeAiBaseUrl(value: unknown) {
  const input = normalizeShortText(value, "API 基础地址", 500).replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new Error("API 基础地址不是有效网址");
  }

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && localHosts.has(parsed.hostname))) {
    throw new Error("API 地址必须使用 HTTPS，本机模型可使用 localhost HTTP");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("API 地址不能包含账号、密码、查询参数或锚点");
  }
  return parsed.toString().replace(/\/+$/, "");
}

function chatCompletionUrl(baseUrl: string) {
  return baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl}/chat/completions`;
}

async function desktopSafeStorage() {
  if (process.env.WORKSTATION_DESKTOP !== "1") return null;
  const injected = (globalThis as typeof globalThis & {
    __WORKSTATION_SAFE_STORAGE__?: {
      isEncryptionAvailable(): boolean;
      encryptString(value: string): Buffer;
      decryptString(value: Buffer): string;
    };
  }).__WORKSTATION_SAFE_STORAGE__;
  if (injected?.isEncryptionAvailable()) return injected;
  try {
    const electron = await import("electron");
    const safeStorage = electron.safeStorage ?? (electron.default as unknown as { safeStorage?: typeof electron.safeStorage })?.safeStorage;
    return safeStorage?.isEncryptionAvailable() ? safeStorage : null;
  } catch {
    return null;
  }
}

async function readAiConfig(): Promise<AiConfig | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(localSecretsPath, "utf8")) as Partial<StoredAiConfig>;
    const safeStorage = await desktopSafeStorage();
    let apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
    if (typeof parsed.apiKeyEncrypted === "string" && parsed.apiKeyEncrypted) {
      if (!safeStorage) return null;
      apiKey = safeStorage.decryptString(Buffer.from(parsed.apiKeyEncrypted, "base64"));
    }
    if (
      typeof parsed.provider !== "string" ||
      typeof parsed.providerName !== "string" ||
      typeof parsed.baseUrl !== "string" ||
      typeof parsed.model !== "string" ||
      !apiKey
    ) {
      return null;
    }
    if (safeStorage && parsed.apiKey && !parsed.apiKeyEncrypted) {
      const migrated: StoredAiConfig = {
        provider: parsed.provider,
        providerName: parsed.providerName,
        baseUrl: parsed.baseUrl,
        model: parsed.model,
        updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
        lastTestedAt: typeof parsed.lastTestedAt === "string" ? parsed.lastTestedAt : undefined,
        apiKeyEncrypted: safeStorage.encryptString(apiKey).toString("base64"),
        encryption: "electron-safe-storage-v1",
      };
      await fs.writeFile(localSecretsPath, `${JSON.stringify(migrated, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    }
    return {
      provider: parsed.provider,
      providerName: parsed.providerName,
      baseUrl: parsed.baseUrl,
      model: parsed.model,
      apiKey,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      lastTestedAt: typeof parsed.lastTestedAt === "string" ? parsed.lastTestedAt : undefined,
    };
  } catch {
    return null;
  }
}

async function writeAiConfig(config: AiConfig) {
  const safeStorage = await desktopSafeStorage();
  const stored: StoredAiConfig = safeStorage
    ? {
        provider: config.provider,
        providerName: config.providerName,
        baseUrl: config.baseUrl,
        model: config.model,
        updatedAt: config.updatedAt,
        lastTestedAt: config.lastTestedAt,
        apiKeyEncrypted: safeStorage.encryptString(config.apiKey).toString("base64"),
        encryption: "electron-safe-storage-v1",
      }
    : config;
  await fs.writeFile(
    localSecretsPath,
    `${JSON.stringify(stored, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
}

function aiStatus(config: AiConfig | null) {
  if (!config) return { configured: false };
  const keyTail = config.apiKey.slice(-4);
  return {
    configured: true,
    provider: config.provider,
    providerName: config.providerName,
    baseUrl: config.baseUrl,
    model: config.model,
    keyHint: `已保存 ····${keyTail}`,
    updatedAt: config.updatedAt,
    lastTestedAt: config.lastTestedAt,
  };
}

function normalizeAiContext(value: unknown): AiContext {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const tasks = Array.isArray(source.tasks) ? source.tasks.slice(0, 25) : [];
  const notes = Array.isArray(source.notes) ? source.notes.slice(0, 10) : [];
  const captures = Array.isArray(source.captures) ? source.captures.slice(0, 10) : [];

  return {
    tasks: tasks.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      if (typeof item.title !== "string" || !item.title.trim()) return [];
      return [{
        id: typeof item.id === "string" ? item.id.trim().slice(0, 160) : "",
        title: item.title.trim().slice(0, 500),
        project: typeof item.project === "string" ? item.project.trim().slice(0, 200) : "",
        done: item.done === true,
        period: item.period === "recent" ? "recent" : "today",
      }];
    }),
    notes: notes.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      if (typeof item.title !== "string" || !item.title.trim()) return [];
      return [{
        title: item.title.trim().slice(0, 300),
        path: typeof item.path === "string" ? item.path.trim().slice(0, 600) : "",
        excerpt: typeof item.excerpt === "string" ? item.excerpt.trim().slice(0, 1000) : "",
      }];
    }),
    captures: captures.flatMap((raw) => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      if (typeof item.text !== "string" || !item.text.trim()) return [];
      return [{
        text: item.text.trim().slice(0, 1000),
        createdAt: typeof item.createdAt === "string" ? item.createdAt.slice(0, 40) : "",
      }];
    }),
  };
}

function normalizeAiHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(-12).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (item.role !== "user" && item.role !== "assistant") return [];
    if (typeof item.content !== "string" || !item.content.trim()) return [];
    return [{
      role: item.role,
      content: item.content.trim().slice(0, 6000),
    }];
  });
}

function extractAgentActions(rawText: string) {
  const match = rawText.match(/<workstation_actions>\s*([\s\S]*?)\s*<\/workstation_actions>/i);
  if (!match) return { text: rawText, actions: [] as AiAgentAction[] };

  const text = rawText.replace(match[0], "").trim();
  try {
    const jsonText = match[1].replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(jsonText) as { actions?: unknown };
    const rawActions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 8) : [];
    const actions = rawActions.flatMap((raw): AiAgentAction[] => {
      if (!raw || typeof raw !== "object") return [];
      const item = raw as Record<string, unknown>;
      if (
        item.type !== "add_task" &&
        item.type !== "complete_task" &&
        item.type !== "rename_task" &&
        item.type !== "delete_task"
      ) return [];
      if (typeof item.title !== "string" || !item.title.trim()) return [];
      const title = item.title.trim().slice(0, 500);
      const taskId = typeof item.taskId === "string" ? item.taskId.trim().slice(0, 160) : "";
      if (item.type === "rename_task") {
        if (!taskId) return [];
        if (typeof item.newTitle !== "string" || !item.newTitle.trim()) return [];
        return [{ type: item.type, title, taskId, newTitle: item.newTitle.trim().slice(0, 500) }];
      }
      if (item.type !== "add_task" && !taskId) return [];
      return [{
        type: item.type,
        title,
        taskId: taskId || undefined,
        period: item.period === "recent" ? "recent" : "today",
      }];
    });
    return {
      text: text || (actions.length ? "我已经整理好准备执行的更改，请你确认。" : rawText),
      actions,
    };
  } catch {
    return { text: rawText.replace(match[0], "").trim() || rawText, actions: [] as AiAgentAction[] };
  }
}

function parseCanvasAiProposal(rawText: string) {
  const normalized = rawText.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(normalized) as Record<string, unknown>;
  } catch {
    throw new Error("模型没有返回可用的画布结构，请换一种更具体的说法后重试");
  }
  const summary = typeof parsed.summary === "string"
    ? parsed.summary.trim().slice(0, 500)
    : "已生成一组画布建议。";
  const rawNodes = Array.isArray(parsed.nodes) ? parsed.nodes.slice(0, 12) : [];
  const nodes = rawNodes.flatMap((raw): CanvasAiProposalNode[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (typeof item.title !== "string" || !item.title.trim()) return [];
    const kind = item.kind === "task" || item.kind === "knowledge" || item.kind === "link"
      ? item.kind
      : "note";
    return [{
      kind,
      title: item.title.trim().slice(0, 200),
      body: typeof item.body === "string" ? item.body.trim().slice(0, 1200) : "",
      parentTitle: typeof item.parentTitle === "string" && item.parentTitle.trim()
        ? item.parentTitle.trim().slice(0, 200)
        : undefined,
    }];
  });
  if (!nodes.length) throw new Error("模型没有提出任何可加入画布的节点");
  return { summary, nodes };
}

function safeUpstreamMessage(value: unknown, apiKey: string) {
  const fallback = "模型服务没有返回可用结果";
  if (typeof value !== "string") return fallback;
  return value.replaceAll(apiKey, "[已隐藏密钥]").replace(/[\r\n]+/g, " ").slice(0, 400) || fallback;
}

async function callCompatibleModel(
  config: AiConfig,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  maxTokens: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const upstream = await fetch(chatCompletionUrl(config.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: false,
        max_tokens: maxTokens,
        ...(config.provider === "deepseek" && config.model.startsWith("deepseek-v4-")
          ? { thinking: { type: "disabled" } }
          : {}),
      }),
      signal: controller.signal,
    });
    const raw = await upstream.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // The sanitized text below is more useful than a JSON parse error.
    }
    if (!upstream.ok) {
      const errorObject = payload.error && typeof payload.error === "object"
        ? payload.error as Record<string, unknown>
        : {};
      throw new Error(safeUpstreamMessage(errorObject.message ?? raw, config.apiKey));
    }

    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const first = choices[0] && typeof choices[0] === "object"
      ? choices[0] as Record<string, unknown>
      : {};
    const message = first.message && typeof first.message === "object"
      ? first.message as Record<string, unknown>
      : {};
    const content = typeof message.content === "string" ? message.content.trim() : "";
    if (!content) throw new Error("模型返回了空内容，请检查模型 ID 是否支持对话接口");

    const usage = payload.usage && typeof payload.usage === "object"
      ? payload.usage as Record<string, unknown>
      : {};
    return {
      text: content,
      model: typeof payload.model === "string" ? payload.model : config.model,
      usage: {
        promptTokens: typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined,
        completionTokens: typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined,
        totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("模型请求超过 60 秒，已自动取消");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function resolveVaultFile(vaultRoot: string, target: string, expectedTarget: string) {
  if (target !== expectedTarget) {
    throw new Error(`当前操作只允许访问 ${expectedTarget}`);
  }

  const resolved = path.resolve(vaultRoot, target);
  const allowedRoot = vaultRoot.endsWith(path.sep)
    ? vaultRoot
    : `${vaultRoot}${path.sep}`;

  if (!resolved.startsWith(allowedRoot)) {
    throw new Error("目标文件不在允许的 Vault 范围内");
  }

  return resolved;
}

function resolveReviewFile(vaultRoot: string, reviewFolder: string, date: string) {
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("复盘日期格式不正确");
  }
  const target = `${reviewFolder}/${date}.md`;
  const resolved = path.resolve(vaultRoot, ...target.split("/"));
  const allowedFolder = path.resolve(vaultRoot, ...reviewFolder.split("/"));
  const allowedRoot = allowedFolder.endsWith(path.sep) ? allowedFolder : `${allowedFolder}${path.sep}`;
  if (!resolved.startsWith(allowedRoot)) {
    throw new Error("复盘文件不在允许的 Vault 范围内");
  }
  return { target, filePath: resolved };
}

function normalizeReviewMarkdown(value: unknown) {
  if (typeof value !== "string") throw new Error("复盘正文必须是文字");
  const normalized = value.replace(/\0/g, "").trim();
  if (!normalized) throw new Error("复盘正文不能为空");
  if (normalized.length > 16_000) throw new Error("复盘正文超过 16000 字符");
  return normalized;
}

async function writeFileAtomically(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

type StoredTask = {
  id: string;
  title: string;
  project: string;
  done: boolean;
  period: "today" | "recent";
  createdAt?: string;
  completedAt?: string;
};

function normalizeTaskDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeTasks(value: unknown): StoredTask[] {
  if (!Array.isArray(value) || value.length > 500) {
    throw new Error("任务数据格式无效或数量超过 500 项");
  }

  return value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error(`第 ${index + 1} 项任务无效`);
    const task = raw as Record<string, unknown>;
    const id = typeof task.id === "string" ? task.id.trim().slice(0, 120) : "";
    const title = normalizeCapture(task.title);
    const project =
      typeof task.project === "string"
        ? normalizeCapture(task.project).slice(0, 120)
        : "个人目标";
    const period = task.period === "recent" ? "recent" : "today";
    if (!id) throw new Error(`第 ${index + 1} 项任务缺少 ID`);

    return {
      id,
      title,
      project,
      done: task.done === true,
      period,
      createdAt: normalizeTaskDate(task.createdAt),
      completedAt: task.done === true ? normalizeTaskDate(task.completedAt) : undefined,
    };
  });
}

function taskRevision(content: string) {
  return createHash("sha256").update(content).digest("hex");
}

function serializeTasks(tasks: StoredTask[]) {
  const renderGroup = (period: StoredTask["period"], title: string) => {
    const items = tasks.filter((task) => task.period === period);
    const lines = items.map((task) => {
      const meta = JSON.stringify({
        id: task.id,
        project: task.project,
        period: task.period,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
      });
      return `- [${task.done ? "x" : " "}] ${task.title} <!-- workstation-task:${meta} -->`;
    });
    return `## ${title}\n\n${lines.join("\n") || "_暂无任务_"}`;
  };

  return `${taskMarker}\n# 工作站任务\n\n> 此文件由创作者工作站管理；可在 Obsidian 中修改任务标题或勾选状态。\n\n${renderGroup("today", "今天")}\n\n${renderGroup("recent", "最近目标")}\n`;
}

function parseTasks(content: string): StoredTask[] {
  const pattern = /^- \[([ xX])\] (.*?) <!-- workstation-task:(\{.*\}) -->$/gm;
  const tasks: StoredTask[] = [];

  for (const match of content.matchAll(pattern)) {
    try {
      const meta = JSON.parse(match[3]) as Record<string, unknown>;
      tasks.push(
        ...normalizeTasks([
          {
            ...meta,
            title: match[2],
            done: match[1].toLocaleLowerCase() === "x",
          },
        ]),
      );
    } catch {
      // Ignore malformed task rows while preserving the rest of the managed file.
    }
  }

  return tasks;
}

async function readTaskStore(vaultRoot: string, taskTarget: string) {
  const filePath = resolveVaultFile(vaultRoot, taskTarget, taskTarget);
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  if (!content.trim()) {
    return { enabled: false, conflict: false, tasks: [], revision: "" };
  }
  if (!content.includes(taskMarker)) {
    return { enabled: false, conflict: true, tasks: [], revision: taskRevision(content) };
  }
  return {
    enabled: true,
    conflict: false,
    tasks: parseTasks(content),
    revision: taskRevision(content),
  };
}

function normalizeCapture(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("捕获内容必须是文字");
  }

  const normalized = value
    .trim()
    .replace(/[\r\n]+/g, " ")
    .replace(/<!--|-->/g, "")
    .slice(0, 1000);

  if (!normalized) {
    throw new Error("捕获内容不能为空");
  }

  return normalized;
}

async function readJsonBody(request: IncomingMessage) {
  let raw = "";

  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 20_000) {
      throw new Error("请求内容过大");
    }
  }

  return JSON.parse(raw || "{}");
}

function parseCaptures(content: string) {
  const pattern = /^- \[ \] (.+?) <!-- captured: (.+?) -->$/gm;
  return [...content.matchAll(pattern)]
    .map((match) => ({ text: match[1], createdAt: match[2] }))
    .reverse();
}

function resolveCaptureEntry(content: string, text: string, createdAt: string, resolution: "task" | "archive") {
  const match = content.split(/\r?\n/).map((line) => ({
    line,
    parts: line.match(/^- \[ \] (.+?) <!-- captured: (.+?) -->$/),
  })).find(({ parts }) =>
    parts && parts[2] === createdAt && normalizeCapture(parts[1]) === text,
  );
  if (!match?.parts) {
    throw new Error("这条收件箱内容已经处理或不存在，请刷新后重试");
  }
  const resolvedAt = new Date().toISOString();
  const replacement = `- [x] ${text} <!-- captured: ${createdAt}; resolved: ${resolvedAt}; resolution: ${resolution} -->`;
  return { content: content.replace(match.line, replacement), resolvedAt };
}

async function collectMarkdownFiles(directory: string, depth = 0): Promise<string[]> {
  if (depth > 8) return [];

  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries) {
    if (files.length >= maxIndexedNotes) break;
    if (entry.name.startsWith(".")) continue;

    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(entryPath, depth + 1);
      files.push(...nested.slice(0, maxIndexedNotes - files.length));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

function plainText(content: string) {
  return content
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function noteTitle(content: string, filePath: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || path.basename(filePath, path.extname(filePath));
}

function noteExcerpt(content: string, query: string) {
  const text = plainText(content);
  if (!text) return "这篇笔记暂时没有正文。";

  const index = query ? text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : 0;
  const start = Math.max(0, index - 45);
  const excerpt = text.slice(start, start + 170);
  return `${start > 0 ? "…" : ""}${excerpt}${start + 170 < text.length ? "…" : ""}`;
}

const retrievalStopTokens = new Set([
  "一个", "一些", "这个", "那个", "我的", "我们", "你们", "什么", "怎么", "怎样", "如何",
  "是否", "可以", "应该", "需要", "有没有", "知道", "帮我", "请问", "一下", "关于", "以及",
  "the", "and", "for", "with", "what", "how", "can", "should",
]);

function normalizedRetrievalText(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

function addWeightedToken(tokens: Map<string, number>, token: string, weight: number) {
  const normalized = normalizedRetrievalText(token).trim();
  if (normalized.length < 2 || retrievalStopTokens.has(normalized)) return;
  tokens.set(normalized, Math.max(tokens.get(normalized) ?? 0, weight));
}

function retrievalQueryTokens(query: string) {
  const normalized = normalizedRetrievalText(query);
  const tokens = new Map<string, number>();

  for (const match of normalized.matchAll(/[a-z0-9][a-z0-9._-]{1,}/g)) {
    addWeightedToken(tokens, match[0], 3);
  }

  for (const match of normalized.matchAll(/[\p{Script=Han}]+/gu)) {
    const phrase = match[0];
    if (phrase.length >= 2 && phrase.length <= 8) addWeightedToken(tokens, phrase, 4);
    for (const size of [2, 3]) {
      if (phrase.length < size) continue;
      for (let index = 0; index <= phrase.length - size; index += 1) {
        addWeightedToken(tokens, phrase.slice(index, index + size), size === 3 ? 2.2 : 1.2);
      }
    }
  }

  return [...tokens.entries()].map(([token, weight]) => ({ token, weight }));
}

function markdownChunks(content: string) {
  const text = plainText(content);
  if (!text) return [];
  const chunks: Array<{ index: number; text: string }> = [];
  const maxLength = 900;
  const overlap = 140;
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = Math.min(text.length, start + maxLength);
    if (end < text.length) {
      const boundary = Math.max(
        text.lastIndexOf("。", end),
        text.lastIndexOf("！", end),
        text.lastIndexOf("？", end),
        text.lastIndexOf(". ", end),
      );
      if (boundary > start + Math.floor(maxLength * 0.62)) end = boundary + 1;
    }
    chunks.push({ index, text: text.slice(start, end).trim() });
    if (end >= text.length) break;
    start = Math.max(start + 1, end - overlap);
    index += 1;
  }

  return chunks.filter((chunk) => chunk.text.length > 0);
}

function countOccurrences(text: string, token: string) {
  let count = 0;
  let cursor = 0;
  while (count < 5) {
    const found = text.indexOf(token, cursor);
    if (found < 0) break;
    count += 1;
    cursor = found + token.length;
  }
  return count;
}

function scoreKnowledgeChunk(
  query: string,
  tokens: Array<{ token: string; weight: number }>,
  title: string,
  relativePath: string,
  chunk: string,
) {
  const normalizedTitle = normalizedRetrievalText(title);
  const normalizedPath = normalizedRetrievalText(relativePath);
  const normalizedChunk = normalizedRetrievalText(chunk);
  let score = 0;
  let matched = 0;

  for (const { token, weight } of tokens) {
    const bodyHits = countOccurrences(normalizedChunk, token);
    const titleHit = normalizedTitle.includes(token);
    const pathHit = normalizedPath.includes(token);
    if (!bodyHits && !titleHit && !pathHit) continue;
    matched += 1;
    score += Math.min(bodyHits, 3) * weight;
    if (titleHit) score += weight * 4;
    if (pathHit) score += weight * 2;
  }

  if (!matched) return 0;
  const compactQuery = normalizedRetrievalText(query).replace(/[^a-z0-9\p{Script=Han}]+/gu, "");
  if (compactQuery.length >= 2 && compactQuery.length <= 32) {
    const compactChunk = normalizedChunk.replace(/[^a-z0-9\p{Script=Han}]+/gu, "");
    if (compactChunk.includes(compactQuery)) score += 18;
  }
  const coverage = matched / Math.max(tokens.length, 1);
  return score * (0.65 + coverage * 0.9);
}

async function retrieveVaultKnowledge(vaultRoot: string, query: string, requestedLimit = 6) {
  const normalizedQuery = query.trim().slice(0, 500);
  const tokens = retrievalQueryTokens(normalizedQuery);
  if (!normalizedQuery || !tokens.length) return [];
  const files = await collectMarkdownFiles(vaultRoot);
  const candidates: KnowledgeSource[] = [];

  for (const filePath of files) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.size > 1_000_000) continue;
    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    if (!content) continue;
    const title = noteTitle(content, filePath);
    const relativePath = path.relative(vaultRoot, filePath).split(path.sep).join("/");
    for (const chunk of markdownChunks(content)) {
      const score = scoreKnowledgeChunk(normalizedQuery, tokens, title, relativePath, chunk.text);
      if (score <= 0) continue;
      candidates.push({
        id: createHash("sha1").update(`${relativePath}:${chunk.index}`).digest("hex").slice(0, 12),
        path: relativePath,
        title,
        excerpt: chunk.text.slice(0, 900),
        modifiedAt: stat.mtime.toISOString(),
        score: Math.round(score * 100) / 100,
      });
    }
  }

  const limit = Math.min(Math.max(Math.floor(requestedLimit), 1), 8);
  const selected: KnowledgeSource[] = [];
  const perNote = new Map<string, number>();
  let totalCharacters = 0;
  const ranked = candidates.sort((left, right) => right.score - left.score);
  const minimumScore = Math.max(2.5, (ranked[0]?.score ?? 0) * 0.12);
  for (const candidate of ranked) {
    if (candidate.score < minimumScore) continue;
    if ((perNote.get(candidate.path) ?? 0) >= 2) continue;
    if (totalCharacters + candidate.excerpt.length > 7_000 && selected.length > 0) continue;
    selected.push(candidate);
    perNote.set(candidate.path, (perNote.get(candidate.path) ?? 0) + 1);
    totalCharacters += candidate.excerpt.length;
    if (selected.length >= limit) break;
  }
  return selected;
}

function requestsWritingStyle(query: string) {
  return /(写作风格|我的风格|以前.*(?:文章|内容)|历史.*(?:文章|内容)|旧文章|仿写|模仿.*写|照着.*写)/u.test(query);
}

async function recentWritingSamples(
  vaultRoot: string,
  existing: KnowledgeSource[],
  requestedLimit = 6,
) {
  const existingPaths = new Set(existing.map((source) => source.path));
  const files = await collectMarkdownFiles(vaultRoot);
  const candidates: Array<{ filePath: string; modifiedAt: string }> = [];

  for (const filePath of files) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.size < 180 || stat.size > 1_000_000) continue;
    candidates.push({ filePath, modifiedAt: stat.mtime.toISOString() });
  }

  const selected: KnowledgeSource[] = [];
  let totalCharacters = existing.reduce((sum, source) => sum + source.excerpt.length, 0);
  for (const candidate of candidates.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))) {
    const relativePath = path.relative(vaultRoot, candidate.filePath).split(path.sep).join("/");
    if (existingPaths.has(relativePath)) continue;
    if (/^(?:Workstation|_系统\/工作站)\//u.test(relativePath)) continue;
    const content = await fs.readFile(candidate.filePath, "utf8").catch(() => "");
    if (!content || content.includes(taskMarker) || content.includes(reviewMarker)) continue;
    const sample = markdownChunks(content, 1_200, 120)[0]?.text ?? "";
    if (plainText(sample).length < 160) continue;
    if (totalCharacters + sample.length > 8_000 && selected.length > 0) break;
    selected.push({
      id: createHash("sha1").update(`${relativePath}:writing-sample`).digest("hex").slice(0, 12),
      path: relativePath,
      title: noteTitle(content, candidate.filePath),
      excerpt: sample.slice(0, 1_200),
      modifiedAt: candidate.modifiedAt,
      score: 1,
    });
    totalCharacters += sample.length;
    if (existing.length + selected.length >= Math.min(Math.max(requestedLimit, 1), 8)) break;
  }
  return selected;
}

function knowledgeContextText(sources: KnowledgeSource[]) {
  return sources.map((source, index) =>
    `[${index + 1}] ${source.title} | ${source.path}\n${source.excerpt}`,
  ).join("\n\n");
}

async function searchVaultNotes(vaultRoot: string, query: string) {
  const files = await collectMarkdownFiles(vaultRoot);
  const normalizedQuery = query.toLocaleLowerCase();
  const notes = [];

  for (const filePath of files) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.size > 1_000_000) continue;

    const content = await fs.readFile(filePath, "utf8").catch(() => "");
    const title = noteTitle(content, filePath);
    const searchable = `${title}\n${content}`.toLocaleLowerCase();
    if (normalizedQuery && !searchable.includes(normalizedQuery)) continue;

    notes.push({
      path: path.relative(vaultRoot, filePath).split(path.sep).join("/"),
      title,
      excerpt: noteExcerpt(content, query),
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  return notes
    .sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt))
    .slice(0, 30);
}

function vaultConnector(): Plugin {
  const middleware = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (!url.pathname.startsWith("/api/vault/") && !url.pathname.startsWith("/api/ai/") && !url.pathname.startsWith("/api/media/")) {
      next();
      return;
    }

    try {
      if (desktopSessionToken && request.headers["x-workstation-token"] !== desktopSessionToken) {
        sendJson(response, 403, { error: "本机接口拒绝了未经授权的请求" });
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/media/")) {
        const id = decodeURIComponent(url.pathname.slice("/api/media/".length));
        if (!/^[a-f0-9-]{36}(?:\.[a-z0-9]{1,12})?$/i.test(id)) {
          sendJson(response, 400, { error: "附件标识不正确" });
          return;
        }
        const filePath = path.join(mediaRoot, id);
        const stat = await fs.stat(filePath).catch(() => null);
        if (!stat?.isFile()) {
          sendJson(response, 404, { error: "附件不存在或已被移动" });
          return;
        }
        const mimeByExtension: Record<string, string> = {
          ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
          ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
          ".mp3": "audio/mpeg", ".wav": "audio/wav", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
          ".pdf": "application/pdf",
        };
        response.statusCode = 200;
        response.setHeader("Content-Type", mimeByExtension[path.extname(id).toLowerCase()] ?? "application/octet-stream");
        response.setHeader("Content-Length", stat.size);
        response.setHeader("Cache-Control", "private, max-age=3600");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.end(await fs.readFile(filePath));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/ai/status") {
        sendJson(response, 200, aiStatus(await readAiConfig()));
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/ai/config") {
        const body = await readJsonBody(request);
        const existing = await readAiConfig();
        const provider = normalizeShortText(body.provider, "供应商标识", 50);
        const providerName = normalizeShortText(body.providerName, "供应商名称", 80);
        const baseUrl = normalizeAiBaseUrl(body.baseUrl);
        const model = normalizeShortText(body.model, "模型 ID", 160);
        const suppliedKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
        const apiKey = suppliedKey || existing?.apiKey || "";
        if (!apiKey) throw new Error("请填写 API Key");
        if (apiKey.length > 1000 || /[\r\n\0]/.test(apiKey)) {
          throw new Error("API Key 格式不正确");
        }

        const connectionChanged = !existing ||
          existing.provider !== provider ||
          existing.baseUrl !== baseUrl ||
          existing.model !== model ||
          Boolean(suppliedKey);
        const config: AiConfig = {
          provider,
          providerName,
          baseUrl,
          model,
          apiKey,
          updatedAt: new Date().toISOString(),
          lastTestedAt: connectionChanged ? undefined : existing.lastTestedAt,
        };
        await writeAiConfig(config);
        sendJson(response, 200, aiStatus(config));
        return;
      }

      if (request.method === "DELETE" && url.pathname === "/api/ai/config") {
        await fs.unlink(localSecretsPath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
        sendJson(response, 200, { configured: false, cleared: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ai/test") {
        const config = await readAiConfig();
        if (!config) throw new Error("请先保存模型配置");
        try {
          const result = await callCompatibleModel(
            config,
            [
              { role: "system", content: "你是连接测试助手。" },
              { role: "user", content: "只回复：连接成功" },
            ],
            32,
          );
          config.lastTestedAt = new Date().toISOString();
          await writeAiConfig(config);
          sendJson(response, 200, {
            ok: true,
            preview: result.text.slice(0, 80),
            model: result.model,
            lastTestedAt: config.lastTestedAt,
          });
        } catch (error) {
          sendJson(response, 502, {
            error: error instanceof Error ? error.message : "模型连接测试失败",
          });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ai/canvas") {
        const body = await readJsonBody(request);
        const requestText = normalizeShortText(body.request, "画布 AI 要求", 4000);
        const currentNodes = Array.isArray(body.nodes)
          ? body.nodes.slice(0, 60).flatMap((raw) => {
              if (!raw || typeof raw !== "object") return [];
              const item = raw as Record<string, unknown>;
              if (typeof item.title !== "string" || !item.title.trim()) return [];
              return [{
                title: item.title.trim().slice(0, 200),
                body: typeof item.body === "string" ? item.body.trim().slice(0, 800) : "",
                kind: item.kind === "task" || item.kind === "knowledge" || item.kind === "link"
                  ? item.kind
                  : "note",
                selected: item.selected === true,
              }];
            })
          : [];
        const currentEdges = Array.isArray(body.edges)
          ? body.edges.slice(0, 120).flatMap((raw) => {
              if (!raw || typeof raw !== "object") return [];
              const item = raw as Record<string, unknown>;
              if (typeof item.source !== "string" || typeof item.target !== "string") return [];
              return [{ source: item.source.slice(0, 200), target: item.target.slice(0, 200) }];
            })
          : [];
        const config = await readAiConfig();
        if (!config) throw new Error("请先在 AI 助手中保存模型配置");
        try {
          const result = await callCompatibleModel(
            config,
            [
              {
                role: "system",
                content: `你是创作者工作站的画布结构助手。用户会给出当前节点、已有连接和一条要求。你的工作是提出可以加入画布的新节点，不要声称已经执行，不要重复已有节点，也不要修改或删除现有内容。

只返回 JSON，不要使用 Markdown 代码块。格式：
{"summary":"一句话说明建议","nodes":[{"kind":"note","title":"节点标题","body":"节点正文","parentTitle":"要连接到的现有或新节点标题"}]}

kind 只允许 note、task、knowledge、link。parentTitle 可省略；填写时必须准确使用现有节点或本次新节点的标题。一次最多 12 个节点。节点正文要具体、简短、可直接使用。`,
              },
              {
                role: "user",
                content: `用户要求：\n${requestText}\n\n当前画布节点：\n${JSON.stringify(currentNodes, null, 2)}\n\n当前连接：\n${JSON.stringify(currentEdges, null, 2)}`,
              },
            ],
            1800,
          );
          const proposal = parseCanvasAiProposal(result.text);
          sendJson(response, 200, { ok: true, ...proposal, model: result.model, usage: result.usage });
        } catch (error) {
          sendJson(response, 502, {
            error: error instanceof Error ? error.message : "画布 AI 生成失败",
          });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/ai/generate") {
        const body = await readJsonBody(request);
        const mode = normalizeShortText(body.mode, "辅助模式", 40);
        const requestText = normalizeShortText(body.request, "给 AI 的要求", 8000);
        const context = normalizeAiContext(body.context);
        const history = normalizeAiHistory(body.history);
        const useKnowledgeBase = body.useKnowledgeBase === true;
        let sources: KnowledgeSource[] = [];
        if (useKnowledgeBase) {
          const connection = await getVaultConnection();
          sources = await retrieveVaultKnowledge(connection.root, requestText, 6);
          if (requestsWritingStyle(requestText)) {
            const samples = await recentWritingSamples(connection.root, sources, 6);
            sources = [...sources, ...samples].slice(0, 6);
          }
        }
        if (mode === "knowledge" && !useKnowledgeBase) {
          throw new Error("请先允许本机检索 Obsidian 知识库");
        }
        if (mode === "knowledge" && !sources.length) {
          sendJson(response, 200, {
            ok: true,
            grounded: false,
            text: "我没有在你的知识库中找到足够相关的内容。你可以换一组更具体的关键词，或先把相关资料整理进 Obsidian 后再问。",
            sources: [],
          });
          return;
        }
        const config = await readAiConfig();
        if (!config) throw new Error("请先保存模型配置");
        const modeLabels: Record<string, string> = {
          agent: "工作站智能体",
          plan: "今日规划",
          content: "内容提纲",
          review: "任务复盘",
          knowledge: "知识库问答",
        };
        const contextText = JSON.stringify({ ...context, notes: [] }, null, 2);
        const retrievedText = sources.length
          ? `\n\n从用户私人知识库本机检索到的片段（仅发送以下命中内容）：\n${knowledgeContextText(sources)}`
          : "\n\n本次没有读取用户私人知识库。";
        try {
          const result = await callCompatibleModel(
            config,
            [
              {
                role: "system",
                content: `你是个人创作者工作站中的私人 AI 管家。使用简体中文，像可靠的执行助理一样直接理解自然语言，不要求用户记命令。

你可以读取本次明确授权的目标任务、收件箱，以及从 Obsidian 私人知识库中命中的少量片段。缺少信息时直接指出，不要虚构任务、笔记、数据或执行结果。使用知识库片段时在相关结论后用 [1]、[2] 标注来源，且不要引用未提供的笔记。用户要求分析、复盘、写作或仿写时，直接在正常回复中完成；仿写前先概括从样本中观察到的风格特征。

当且仅当用户明确要求修改工作站任务时，你可以在正常回复末尾追加一个操作块。操作块不会直接执行，必须等待用户在界面确认。不要声称已经完成修改。格式必须完全如下：
<workstation_actions>
{"actions":[{"type":"complete_task","taskId":"任务唯一 ID","title":"任务标题"}]}
</workstation_actions>

允许的操作只有：
- add_task：新增任务，period 为 today 或 recent。
- complete_task：完成已有任务，必须同时使用上下文中的 taskId 和准确标题。
- rename_task：重命名已有任务，必须使用 taskId、准确 title 和 newTitle。
- delete_task：删除已有任务，必须同时使用上下文中的 taskId 和准确标题。

除 add_task 外，不允许自行编造 taskId；找不到唯一对应任务时先向用户确认，不输出操作块。

一次最多 8 个操作。用户没有明确要求修改时绝不输出操作块。正常回复使用清晰的 Markdown。`,
              },
              ...history,
              {
                role: "user",
                content: `辅助模式：${modeLabels[mode] ?? mode}\n\n用户要求：\n${requestText}\n\n本次用户明确授权的工作站上下文：\n${contextText}${retrievedText}`,
              },
            ],
            1600,
          );
          const agentResult = extractAgentActions(result.text);
          sendJson(response, 200, {
            ok: true,
            grounded: sources.length > 0,
            sources,
            ...result,
            text: agentResult.text,
            actions: agentResult.actions,
          });
        } catch (error) {
          sendJson(response, 502, {
            error: error instanceof Error ? error.message : "模型生成失败",
          });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/vault/configure") {
        if (process.env.WORKSTATION_VAULT_PATH) {
          throw new Error("当前 Vault 由 WORKSTATION_VAULT_PATH 管理，请先移除环境变量");
        }

        const body = await readJsonBody(request);
        const requestedPath =
          typeof body.vaultPath === "string" ? body.vaultPath.trim() : "";
        if (!requestedPath || requestedPath.length > 1000 || !path.isAbsolute(requestedPath)) {
          throw new Error("请输入完整的 Vault 文件夹路径");
        }

        const configuredRoot = path.resolve(requestedPath);
        const stat = await fs.stat(configuredRoot).catch(() => null);
        if (!stat?.isDirectory()) {
          throw new Error("没有找到这个文件夹，请检查路径后重试");
        }

        const hasObsidianConfig = Boolean(
          await fs.stat(path.join(configuredRoot, ".obsidian")).catch(() => null),
        );
        const managedTargets = await suggestManagedTargets(configuredRoot);
        const configuredCaptureTarget = normalizeVaultMarkdownTarget(
          body.captureTarget,
          await suggestCaptureTarget(configuredRoot),
        );
        const configuredTaskTarget = normalizeVaultMarkdownTarget(
          body.taskTarget,
          managedTargets.taskTarget,
        );
        const configuredReviewFolder = normalizeVaultDirectory(
          body.reviewFolder,
          managedTargets.reviewFolder,
        );
        await fs.writeFile(
          localConfigPath,
          `${JSON.stringify(
            {
              vaultPath: configuredRoot,
              captureTarget: configuredCaptureTarget,
              taskTarget: configuredTaskTarget,
              reviewFolder: configuredReviewFolder,
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
        sendJson(response, 200, {
          connected: true,
          mode: "configured",
          source: "local-config",
          vaultPath: configuredRoot,
          vaultName: path.basename(configuredRoot),
          target: configuredCaptureTarget,
          taskTarget: configuredTaskTarget,
          reviewFolder: configuredReviewFolder,
          hasObsidianConfig,
        });
        return;
      }

      const connection = await getVaultConnection();
      const vaultRoot = connection.root;
      const captureTarget = connection.captureTarget;
      const taskTarget = connection.taskTarget;
      const reviewFolder = connection.reviewFolder;

      if (request.method === "POST" && url.pathname === "/api/vault/retrieve") {
        const body = await readJsonBody(request);
        const query = normalizeShortText(body.query, "知识库问题", 500);
        const requestedLimit = typeof body.limit === "number" ? body.limit : 6;
        const sources = await retrieveVaultKnowledge(vaultRoot, query, requestedLimit);
        sendJson(response, 200, {
          ok: true,
          query,
          sources,
          total: sources.length,
          privacy: "检索在本机完成；此接口不会调用外部模型。",
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/vault/status") {
        await fs.access(vaultRoot);
        const hasObsidianConfig = Boolean(
          await fs.stat(path.join(vaultRoot, ".obsidian")).catch(() => null),
        );
        sendJson(response, 200, {
          connected: true,
          mode: connection.mode,
          source: connection.source,
          vaultPath: vaultRoot,
          vaultName: path.basename(vaultRoot),
          target: captureTarget,
          taskTarget,
          reviewFolder,
          hasObsidianConfig,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/vault/captures") {
        const filePath = resolveVaultFile(vaultRoot, captureTarget, captureTarget);
        const content = await fs.readFile(filePath, "utf8").catch(() => "");
        const entries = parseCaptures(content);
        sendJson(response, 200, { entries: entries.slice(0, 100), total: entries.length });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/vault/captures/resolve") {
        const body = await readJsonBody(request);
        const text = normalizeCapture(body.text);
        const createdAt = typeof body.createdAt === "string" ? body.createdAt.trim() : "";
        const resolution = body.resolution === "task" ? "task" : body.resolution === "archive" ? "archive" : null;
        if (!createdAt || Number.isNaN(Date.parse(createdAt))) throw new Error("收件箱记录时间格式不正确");
        if (!resolution) throw new Error("请选择转为任务或归档");
        const filePath = resolveVaultFile(vaultRoot, captureTarget, captureTarget);
        const existing = await fs.readFile(filePath, "utf8").catch(() => "");
        const resolved = resolveCaptureEntry(existing, text, createdAt, resolution);
        await writeFileAtomically(filePath, resolved.content);
        const pending = parseCaptures(resolved.content);
        sendJson(response, 200, {
          ok: true,
          text,
          createdAt,
          resolvedAt: resolved.resolvedAt,
          resolution,
          total: pending.length,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/vault/reviews") {
        const directory = path.resolve(vaultRoot, ...reviewFolder.split("/"));
        const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
        const reviews = [];
        for (const entry of entries) {
          if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name)) continue;
          const filePath = path.join(directory, entry.name);
          const content = await fs.readFile(filePath, "utf8").catch(() => "");
          if (!content.includes(reviewMarker)) continue;
          const stat = await fs.stat(filePath).catch(() => null);
          reviews.push({
            date: entry.name.slice(0, 10),
            target: `${reviewFolder}/${entry.name}`,
            modifiedAt: stat?.mtime.toISOString() ?? "",
          });
        }
        sendJson(response, 200, {
          reviews: reviews.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 60),
          reviewFolder,
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/vault/review") {
        const date = url.searchParams.get("date") ?? "";
        const { filePath, target } = resolveReviewFile(vaultRoot, reviewFolder, date);
        const content = await fs.readFile(filePath, "utf8").catch(() => "");
        if (content && !content.includes(reviewMarker)) {
          sendJson(response, 409, {
            error: `${target} 已存在且不是工作站创建的复盘，未读取或覆盖`,
            conflict: true,
            target,
          });
          return;
        }
        sendJson(response, 200, {
          exists: Boolean(content),
          content: content.replace(`${reviewMarker}\n`, "").trim(),
          revision: content ? taskRevision(content) : "",
          target,
        });
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/vault/review") {
        const body = await readJsonBody(request);
        const date = typeof body.date === "string" ? body.date : "";
        const markdown = normalizeReviewMarkdown(body.markdown);
        const { filePath, target } = resolveReviewFile(vaultRoot, reviewFolder, date);
        const existing = await fs.readFile(filePath, "utf8").catch(() => "");
        if (existing && !existing.includes(reviewMarker)) {
          sendJson(response, 409, {
            error: `${target} 已存在且不是工作站创建的复盘，未执行覆盖`,
            conflict: true,
            target,
          });
          return;
        }
        if (
          existing &&
          typeof body.baseRevision === "string" &&
          body.baseRevision !== taskRevision(existing)
        ) {
          sendJson(response, 409, {
            error: "复盘文件已在其他位置修改，请重新读取后再保存",
            conflict: true,
            code: "REVIEW_REVISION_CONFLICT",
            target,
          });
          return;
        }
        const content = `${reviewMarker}\n${markdown}\n`;
        await writeFileAtomically(filePath, content);
        sendJson(response, 200, {
          ok: true,
          date,
          target,
          revision: taskRevision(content),
          savedAt: new Date().toISOString(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/vault/notes") {
        const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
        const notes = await searchVaultNotes(vaultRoot, query);
        sendJson(response, 200, { notes, query });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/vault/tasks") {
        const store = await readTaskStore(vaultRoot, taskTarget);
        sendJson(response, 200, { ...store, target: taskTarget });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/vault/tasks/enable") {
        const body = await readJsonBody(request);
        const filePath = resolveVaultFile(vaultRoot, taskTarget, taskTarget);
        const existing = await readTaskStore(vaultRoot, taskTarget);

        if (existing.conflict) {
          sendJson(response, 409, {
            error: `${taskTarget} 已存在且不是工作站管理的文件，未执行覆盖`,
            code: "TASK_FILE_CONFLICT",
            ...existing,
            target: taskTarget,
          });
          return;
        }

        if (existing.enabled) {
          sendJson(response, 200, { ...existing, target: taskTarget, created: false });
          return;
        }

        const tasks = normalizeTasks(body.tasks);
        const content = serializeTasks(tasks);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, "utf8");
        sendJson(response, 200, {
          enabled: true,
          conflict: false,
          tasks,
          revision: taskRevision(content),
          target: taskTarget,
          created: true,
        });
        return;
      }

      if (request.method === "PUT" && url.pathname === "/api/vault/tasks") {
        const body = await readJsonBody(request);
        const filePath = resolveVaultFile(vaultRoot, taskTarget, taskTarget);
        const existing = await readTaskStore(vaultRoot, taskTarget);
        if (!existing.enabled || existing.conflict) {
          throw new Error(`${taskTarget} 尚未启用或存在文件冲突`);
        }
        if (typeof body.baseRevision !== "string" || body.baseRevision !== existing.revision) {
          sendJson(response, 409, {
            error: "Obsidian 中的任务文件已发生变化，请重新载入后再编辑",
            code: "TASK_REVISION_CONFLICT",
            ...existing,
            target: taskTarget,
          });
          return;
        }

        const tasks = normalizeTasks(body.tasks);
        const content = serializeTasks(tasks);
        await fs.writeFile(filePath, content, "utf8");
        sendJson(response, 200, {
          enabled: true,
          conflict: false,
          tasks,
          revision: taskRevision(content),
          target: taskTarget,
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/vault/append") {
        const body = await readJsonBody(request);
        const target = typeof body.target === "string" ? body.target : "";
        const text = normalizeCapture(body.text);
        const createdAt = new Date().toISOString();
        const markdown = `\n- [ ] ${text} <!-- captured: ${createdAt} -->`;
        const filePath = resolveVaultFile(vaultRoot, target, captureTarget);

        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.appendFile(filePath, markdown, "utf8");
        sendJson(response, 200, { ok: true, markdown, createdAt, text });
        return;
      }

      sendJson(response, 404, { error: "未找到本地接口" });
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : "本地接口操作失败",
      });
    }
  };

  return {
    name: "local-obsidian-vault-connector",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), vaultConnector()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@fluentui")) return "fluent-ui";
          if (id.includes("node_modules/react")) return "react-vendor";
          return undefined;
        },
      },
    },
  },
});
