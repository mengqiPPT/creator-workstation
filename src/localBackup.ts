export const workstationLocalKeys = [
  "workstation.tasks.v2",
  "workstation.creator-links",
  "workstation.canvas.v1",
  "workstation.knowledge-calibration.v1",
  "workstation.ai-chat.v1",
  "workstation.ui.v1",
  "workstation.activity.v1",
  "workstation.daily-review-drafts.v1",
  "workstation.daily-review-inputs.v1",
] as const;

export type WorkstationLocalKey = (typeof workstationLocalKeys)[number];

export type WorkstationLocalBackup = {
  format: "workstation-local-backup";
  version: 1;
  exportedAt: string;
  items: Partial<Record<WorkstationLocalKey, string>>;
};

export function createLocalBackup(storage: Storage): WorkstationLocalBackup {
  const items: WorkstationLocalBackup["items"] = {};
  workstationLocalKeys.forEach((key) => {
    const value = storage.getItem(key);
    if (value !== null) items[key] = value;
  });
  return {
    format: "workstation-local-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    items,
  };
}

export function parseLocalBackup(raw: string): WorkstationLocalBackup {
  if (raw.length > 5_000_000) throw new Error("备份文件超过 5 MB，已拒绝导入");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("这不是有效的 JSON 备份文件");
  }

  if (!parsed || typeof parsed !== "object") throw new Error("备份文件结构不正确");
  const candidate = parsed as Partial<WorkstationLocalBackup>;
  if (
    candidate.format !== "workstation-local-backup" ||
    candidate.version !== 1 ||
    !candidate.exportedAt ||
    Number.isNaN(Date.parse(candidate.exportedAt)) ||
    !candidate.items ||
    typeof candidate.items !== "object" ||
    Array.isArray(candidate.items)
  ) {
    throw new Error("这不是工作站支持的本机备份格式");
  }

  const allowedKeys = new Set<string>(workstationLocalKeys);
  for (const [key, value] of Object.entries(candidate.items)) {
    if (!allowedKeys.has(key) || typeof value !== "string") {
      throw new Error(`备份中包含不允许恢复的字段：${key}`);
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(value);
    } catch {
      throw new Error(`备份字段 ${key} 的内容已损坏`);
    }
    validateBackupItem(key as WorkstationLocalKey, decoded);
  }

  return candidate as WorkstationLocalBackup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateBackupItem(key: WorkstationLocalKey, value: unknown) {
  const arrayKeys: WorkstationLocalKey[] = [
    "workstation.tasks.v2",
    "workstation.creator-links",
    "workstation.ai-chat.v1",
    "workstation.activity.v1",
  ];
  if (arrayKeys.includes(key)) {
    if (!Array.isArray(value) || value.length > 2000) throw new Error(`备份字段 ${key} 的结构不正确`);
    if (key === "workstation.tasks.v2" && value.some((item) =>
      !isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.done !== "boolean"
    )) throw new Error("任务备份包含无效记录");
    if (key === "workstation.creator-links" && value.some((item) =>
      !isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string" || typeof item.url !== "string"
    )) throw new Error("创作入口备份包含无效记录");
    if (key === "workstation.ai-chat.v1" && value.some((item) =>
      !isRecord(item) || typeof item.id !== "string" || (item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string"
    )) throw new Error("AI 对话备份包含无效记录");
    if (key === "workstation.activity.v1" && value.some((item) =>
      !isRecord(item) || typeof item.id !== "string" || typeof item.type !== "string" || typeof item.at !== "string" || typeof item.title !== "string"
    )) throw new Error("活动记录备份包含无效记录");
    return;
  }

  if (!isRecord(value)) throw new Error(`备份字段 ${key} 的结构不正确`);
  if (key === "workstation.daily-review-drafts.v1" && (
    Object.keys(value).length > 365 || Object.entries(value).some(([date, draft]) =>
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof draft !== "string" || draft.length > 16_000
    )
  )) throw new Error("每日复盘草稿备份包含无效记录");
  if (key === "workstation.daily-review-inputs.v1" && (
    Object.keys(value).length > 365 || Object.entries(value).some(([date, inputs]) =>
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRecord(inputs) ||
      typeof inputs.wins !== "string" || typeof inputs.friction !== "string" || typeof inputs.tomorrow !== "string"
    )
  )) throw new Error("每日复盘问题备份包含无效记录");
  if (key === "workstation.canvas.v1" && (
    !Array.isArray(value.nodes) || !Array.isArray(value.edges) || value.nodes.length > 1000 || value.edges.length > 2000
  )) throw new Error("画布备份的节点或连线结构不正确");
}

export function restoreLocalBackup(storage: Storage, backup: WorkstationLocalBackup) {
  workstationLocalKeys.forEach((key) => {
    const value = backup.items[key];
    if (typeof value === "string") storage.setItem(key, value);
    else storage.removeItem(key);
  });
}

export function localBackupSummary(backup: WorkstationLocalBackup) {
  return {
    itemCount: Object.keys(backup.items).length,
    exportedAt: backup.exportedAt,
    includesSecrets: false,
  };
}
