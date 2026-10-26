import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import {
  ArrowExport24Regular,
  DarkTheme24Regular,
  Document24Regular,
  Note24Regular,
  Search24Regular,
  Settings24Regular,
  TargetArrow24Regular,
  WeatherSunny24Regular,
  Wand24Regular,
} from "@fluentui/react-icons";
import { navItems } from "./data/navigation";
import { enterKey, escapeKey } from "./lib/platform";
import type { KnowledgeNote, Task, View } from "./types";

type PaletteAction = {
  id: string;
  group: string;
  label: string;
  description?: string;
  icon: ReactElement;
  keywords?: string;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  changeView: (view: View) => void;
  setSettingsOpen: (open: boolean) => void;
  setLinkDialogOpen: (open: boolean) => void;
  setDarkMode: (updater: (current: boolean) => boolean) => void;
  openAiConfig: () => void;
  downloadBackup: () => void;
  focusCapture: () => void;
  focusTask: () => void;
  tasks: Task[];
  notes: KnowledgeNote[];
  darkMode: boolean;
};

export function CommandPalette({
  open,
  onClose,
  changeView,
  setSettingsOpen,
  setLinkDialogOpen,
  setDarkMode,
  openAiConfig,
  downloadBackup,
  focusCapture,
  focusTask,
  tasks,
  notes,
  darkMode,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const actions = useMemo<PaletteAction[]>(() => {
    const items: PaletteAction[] = [];
    for (const nav of navItems) {
      items.push({
        id: `nav:${nav.id}`,
        group: "导航",
        label: `前往「${nav.label}」`,
        description: "切换到该视图",
        icon: nav.icon,
        keywords: `${nav.label} view 视图`,
        run: () => changeView(nav.id),
      });
    }
    items.push(
      {
        id: "action:new-task",
        group: "动作",
        label: "新增今日任务",
        description: "把光标定位到今天的目标任务",
        icon: <TargetArrow24Regular />,
        keywords: "add task todo 新建任务",
        run: () => {
          changeView("today");
          window.setTimeout(focusTask, 60);
        },
      },
      {
        id: "action:quick-capture",
        group: "动作",
        label: "快速捕获一条想法",
        description: "跳到收件箱输入区",
        icon: <Note24Regular />,
        keywords: "capture inbox 收件箱 灵感",
        run: () => {
          changeView("today");
          window.setTimeout(focusCapture, 60);
        },
      },
      {
        id: "action:ai-config",
        group: "动作",
        label: "配置 AI 模型",
        description: "打开 API Key 与供应商设置",
        icon: <Wand24Regular />,
        keywords: "model api key 模型 配置",
        run: () => openAiConfig(),
      },
      {
        id: "action:settings",
        group: "动作",
        label: "Obsidian 连接与本地配置",
        description: "管理 Vault、快捷方式、备份",
        icon: <Settings24Regular />,
        keywords: "vault obsidian 设置 备份",
        run: () => setSettingsOpen(true),
      },
      {
        id: "action:add-creator-link",
        group: "动作",
        label: "添加创作者后台入口",
        description: "保存一个常用平台或工具地址",
        icon: <ArrowExport24Regular />,
        keywords: "creator link 平台 发布",
        run: () => setLinkDialogOpen(true),
      },
      {
        id: "action:toggle-theme",
        group: "外观",
        label: darkMode ? "切换为浅色模式" : "切换为深色模式",
        description: "工作站的颜色主题",
        icon: darkMode ? <WeatherSunny24Regular /> : <DarkTheme24Regular />,
        keywords: "theme dark light 主题 深色 浅色",
        run: () => setDarkMode((current) => !current),
      },
      {
        id: "action:download-backup",
        group: "数据",
        label: "下载本机状态备份",
        description: "导出工作站的本地状态为 JSON",
        icon: <ArrowExport24Regular />,
        keywords: "backup export 备份 导出",
        run: () => downloadBackup(),
      },
    );
    return items;
  }, [changeView, darkMode, downloadBackup, focusCapture, focusTask, openAiConfig, setDarkMode, setLinkDialogOpen, setSettingsOpen]);

  const openTasks = useMemo(
    () => tasks.filter((task) => !task.done).slice(0, 6),
    [tasks],
  );
  const recentNotes = useMemo(() => notes.slice(0, 6), [notes]);

  const grouped = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const match = (item: PaletteAction) =>
      !lower ||
      item.label.toLowerCase().includes(lower) ||
      item.id.toLowerCase().includes(lower) ||
      (item.keywords ?? "").toLowerCase().includes(lower);
    const filteredActions = actions.filter(match);

    const taskMatches: PaletteAction[] = openTasks
      .filter((task) => !lower || task.title.toLowerCase().includes(lower))
      .map((task) => ({
        id: `task:${task.id}`,
        group: "未完成任务",
        label: task.title,
        description: task.project,
        icon: <TargetArrow24Regular />,
        run: () => changeView("goals"),
      }));

    const noteMatches: PaletteAction[] = recentNotes
      .filter((note) => !lower || note.title.toLowerCase().includes(lower) || note.excerpt.toLowerCase().includes(lower))
      .map((note) => ({
        id: `note:${note.path}`,
        group: "最近知识库",
        label: note.title,
        description: note.path,
        icon: <Document24Regular />,
        run: () => changeView("knowledge"),
      }));

    const groups: Array<{ name: string; items: PaletteAction[] }> = [];
    const pushGroup = (name: string, items: PaletteAction[]) => {
      if (items.length) groups.push({ name, items });
    };
    pushGroup("导航", filteredActions.filter((item) => item.group === "导航"));
    pushGroup("动作", filteredActions.filter((item) => item.group === "动作"));
    pushGroup("外观", filteredActions.filter((item) => item.group === "外观"));
    pushGroup("数据", filteredActions.filter((item) => item.group === "数据"));
    pushGroup("未完成任务", taskMatches);
    pushGroup("最近知识库", noteMatches);

    const flat = groups.flatMap((group) => group.items);
    return { groups, flat };
  }, [actions, openTasks, recentNotes, query, changeView]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
      return;
    }
    setCursor(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (cursor >= grouped.flat.length) setCursor(0);
  }, [cursor, grouped.flat.length]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const target = list.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    target?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((current) => Math.min(grouped.flat.length - 1, current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((current) => Math.max(0, current - 1));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const next = grouped.flat[cursor];
        if (next) {
          next.run();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cursor, grouped.flat, onClose, open]);

  if (!open) return null;

  return (
    <div className="command-palette-root" role="dialog" aria-label="命令面板">
      <button
        type="button"
        className="command-palette-backdrop"
        aria-label="关闭命令面板"
        onClick={onClose}
      />
      <div className="command-palette" role="combobox" aria-expanded="true">
        <div className="command-palette-input">
          <Search24Regular aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索任务、笔记、动作或视图…"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd>{escapeKey}</kbd>
        </div>
        <div className="command-palette-list" ref={listRef} role="listbox">
          {grouped.groups.length ? (
            grouped.groups.map((group) => (
              <div key={group.name} className="command-palette-group">
                <span>{group.name}</span>
                <ul>
                  {group.items.map((item) => {
                    const index = grouped.flat.indexOf(item);
                    const isActive = index === cursor;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          data-index={index}
                          className={isActive ? "active" : ""}
                          onMouseEnter={() => setCursor(index)}
                          onClick={() => {
                            item.run();
                            onClose();
                          }}
                        >
                          <span className="command-palette-icon" aria-hidden="true">
                            {item.icon}
                          </span>
                          <span className="command-palette-copy">
                            <strong>{item.label}</strong>
                            {item.description ? <small>{item.description}</small> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          ) : (
            <div className="command-palette-empty">
              <strong>没有匹配项</strong>
              <p>试试搜索“任务”、“知识库”或“主题”。</p>
            </div>
          )}
        </div>
        <div className="command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 选择</span>
          <span><kbd>{enterKey}</kbd> 执行</span>
          <span><kbd>{escapeKey}</kbd> 关闭</span>
        </div>
      </div>
    </div>
  );
}
