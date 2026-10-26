import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Textarea,
} from "@fluentui/react-components";
import {
  Add24Regular,
  ArrowDownload24Regular,
  ArrowUpload24Regular,
  Attach24Regular,
  Board24Regular,
  Checkmark24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Document24Regular,
  Lightbulb24Regular,
  MoreHorizontal24Regular,
  NoteAdd24Regular,
  TargetArrow24Regular,
  VideoClip24Regular,
  ZoomFit24Regular,
} from "@fluentui/react-icons";

type CanvasCardKind = "note" | "task" | "knowledge" | "link" | "media";

type CanvasNodeData = {
  [key: string]: unknown;
  kind: CanvasCardKind;
  title: string;
  body: string;
  sourceId?: string;
  sourcePath?: string;
  connectionCount?: number;
  mediaId?: string;
  mediaUrl?: string;
  mediaName?: string;
  mimeType?: string;
  mediaSize?: number;
};

type CanvasAiProposalNode = {
  kind: CanvasCardKind;
  title: string;
  body: string;
  parentTitle?: string;
};

type CanvasAiProposal = {
  summary: string;
  nodes: CanvasAiProposalNode[];
};

type CanvasNode = Node<CanvasNodeData, "workstation">;

type TaskInput = {
  id: string;
  title: string;
  project: string;
  done: boolean;
};

type KnowledgeInput = {
  path: string;
  title: string;
  excerpt: string;
};

type CanvasWorkspaceProps = {
  tasks: TaskInput[];
  notes: KnowledgeInput[];
  darkMode: boolean;
};

type SavedCanvas = {
  nodes: CanvasNode[];
  edges: Edge[];
  viewport: Viewport;
};

type JsonCanvasNode = {
  id: string;
  type: "text" | "file" | "link" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  file?: string;
  url?: string;
  label?: string;
};

type JsonCanvasEdge = {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: "top" | "right" | "bottom" | "left";
  toSide?: "top" | "right" | "bottom" | "left";
  toEnd?: "none" | "arrow";
  label?: string;
};

type JsonCanvas = {
  nodes?: JsonCanvasNode[];
  edges?: JsonCanvasEdge[];
};

type CanvasTemplate = {
  id: string;
  title: string;
  description: string;
  relation: string;
  icon: ReactElement;
  nodes: Array<{
    position: { x: number; y: number };
    data: CanvasNodeData;
  }>;
  edges: Array<{ from: number; to: number; label?: string }>;
};

const canvasStorageKey = "workstation.canvas.v1";
const defaultViewport: Viewport = { x: 80, y: 60, zoom: 0.9 };

const kindLabels: Record<CanvasCardKind, string> = {
  note: "便签",
  task: "任务",
  knowledge: "知识",
  link: "链接",
  media: "附件",
};

const canvasTemplates: CanvasTemplate[] = [
  {
    id: "topic-decision",
    title: "选题决策",
    description: "比较一个用户问题、选题假设、已有素材和判断标准。",
    relation: "用户问题 → 选题假设 → 判断标准 → 下一步实验",
    icon: <Lightbulb24Regular />,
    nodes: [
      {
        position: { x: 0, y: 180 },
        data: { kind: "note", title: "用户真正的问题", body: "写下一个具体的人，在什么时刻遇到了什么问题。" },
      },
      {
        position: { x: 340, y: 20 },
        data: { kind: "note", title: "选题假设", body: "用一句话说明这条内容准备回答什么。" },
      },
      {
        position: { x: 340, y: 200 },
        data: { kind: "knowledge", title: "已有素材", body: "放入相关笔记、案例、评论或数据来源。" },
      },
      {
        position: { x: 340, y: 380 },
        data: { kind: "note", title: "判断标准", body: "什么证据会让你决定继续做，什么信号会让你放弃。" },
      },
      {
        position: { x: 680, y: 200 },
        data: { kind: "task", title: "下一步实验", body: "今天能完成的最小验证动作。" },
      },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
    ],
  },
  {
    id: "content-pipeline",
    title: "内容项目流",
    description: "跟踪一条真实内容从灵感到复盘的完整经过。",
    relation: "灵感 → 选题 → 脚本 → 素材 → 发布 → 复盘",
    icon: <VideoClip24Regular />,
    nodes: [
      { position: { x: 0, y: 140 }, data: { kind: "note", title: "灵感来源", body: "记录最初触发这条内容的原话、链接或场景。" } },
      { position: { x: 310, y: 140 }, data: { kind: "note", title: "确定选题", body: "一句话选题、目标受众和希望产生的变化。" } },
      { position: { x: 620, y: 140 }, data: { kind: "note", title: "脚本结构", body: "开头钩子、核心段落和结尾行动。" } },
      { position: { x: 930, y: 140 }, data: { kind: "knowledge", title: "素材与来源", body: "放入画面、案例、数据和需要引用的笔记。" } },
      { position: { x: 1240, y: 140 }, data: { kind: "task", title: "发布检查", body: "标题、封面、平台、发布时间和发布前检查。" } },
      { position: { x: 1550, y: 140 }, data: { kind: "note", title: "发布后复盘", body: "记录真实反馈、有效做法和下一条内容要调整的地方。" } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
      { from: 3, to: 4 },
      { from: 4, to: 5 },
    ],
  },
  {
    id: "project-breakdown",
    title: "项目拆解",
    description: "把结果、已知条件、未知问题和下一步行动分开。",
    relation: "目标结果 → 已知与未知 → 下一步行动",
    icon: <TargetArrow24Regular />,
    nodes: [
      { position: { x: 0, y: 180 }, data: { kind: "task", title: "目标结果", body: "完成时能被看见或验证的结果是什么。" } },
      { position: { x: 340, y: 40 }, data: { kind: "knowledge", title: "已知条件", body: "已有资料、资源、限制和已经作出的决定。" } },
      { position: { x: 340, y: 320 }, data: { kind: "note", title: "未知问题", body: "继续推进前必须澄清的事实和风险。" } },
      { position: { x: 680, y: 180 }, data: { kind: "task", title: "下一步行动", body: "不依赖更多规划，现在就能开始的最小动作。" } },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
    ],
  },
];

function loadCanvas(): SavedCanvas {
  try {
    const raw = window.localStorage.getItem(canvasStorageKey);
    if (!raw) return { nodes: [], edges: [], viewport: defaultViewport };
    const parsed = JSON.parse(raw) as Partial<SavedCanvas>;
    return {
      nodes: Array.isArray(parsed.nodes)
        ? parsed.nodes.slice(0, 1000).map(stableCanvasNode)
        : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges.slice(0, 2000) : [],
      viewport: parsed.viewport ?? defaultViewport,
    };
  } catch {
    return { nodes: [], edges: [], viewport: defaultViewport };
  }
}

function WorkstationCanvasNode({ id, data, selected }: NodeProps<CanvasNode>) {
  const { getViewport, setNodes } = useReactFlow<CanvasNode, Edge>();
  const mediaUrl = data.mediaUrl || (data.mediaId ? `/api/media/${encodeURIComponent(data.mediaId)}` : "");
  const isImage = data.mimeType?.startsWith("image/");
  const isVideo = data.mimeType?.startsWith("video/");
  const isAudio = data.mimeType?.startsWith("audio/");
  return (
    <article
      className={`canvas-card canvas-card-${data.kind}${selected ? " selected" : ""}`}
    >
      <Handle id="top" type="source" position={Position.Top} className="canvas-handle canvas-handle-top" />
      <Handle id="right" type="source" position={Position.Right} className="canvas-handle canvas-handle-right" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="canvas-handle canvas-handle-bottom" />
      <Handle id="left" type="source" position={Position.Left} className="canvas-handle canvas-handle-left" />
      <div className="canvas-card-meta">
        <span>{kindLabels[data.kind]}</span>
        {data.connectionCount ? <small>{data.connectionCount} 条连接</small> : null}
        {data.sourcePath ? <code>{data.sourcePath}</code> : null}
      </div>
      <h2>{data.title}</h2>
      {data.kind === "media" && mediaUrl ? (
        <div className="canvas-media-preview">
          {isImage ? <img src={mediaUrl} alt={data.mediaName || data.title} draggable={false} /> : null}
          {isVideo ? <video src={mediaUrl} controls preload="metadata" /> : null}
          {isAudio ? <audio src={mediaUrl} controls preload="metadata" /> : null}
          {!isImage && !isVideo && !isAudio ? <Document24Regular aria-hidden="true" /> : null}
        </div>
      ) : null}
      {data.body ? <p>{data.body}</p> : data.kind !== "media" ? <p className="canvas-card-empty">暂无正文</p> : null}
      {selected ? (
        <button
          type="button"
          className="canvas-manual-resizer nodrag nopan"
          aria-label="拖动调整卡片大小"
          title="拖动调整卡片大小"
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const resizer = event.currentTarget;
            const nodeElement = resizer.closest<HTMLElement>(".react-flow__node");
            if (!nodeElement) return;
            const startWidth = Number.parseFloat(getComputedStyle(nodeElement).width);
            const startHeight = Number.parseFloat(getComputedStyle(nodeElement).height);
            const startX = event.clientX;
            const startY = event.clientY;
            const zoom = getViewport().zoom || 1;
            const pointerId = event.pointerId;
            event.currentTarget.setPointerCapture(pointerId);

            const handleMove = (moveEvent: PointerEvent) => {
              const width = Math.min(900, Math.max(180, startWidth + (moveEvent.clientX - startX) / zoom));
              const height = Math.min(720, Math.max(110, startHeight + (moveEvent.clientY - startY) / zoom));
              setNodes((current) => current.map((node) =>
                node.id === id
                  ? { ...node, style: { ...node.style, width: Math.round(width), height: Math.round(height), minHeight: undefined } }
                  : node,
              ));
            };
            const handleUp = () => {
              window.removeEventListener("pointermove", handleMove);
              window.removeEventListener("pointerup", handleUp);
              resizer.removeEventListener("pointermove", handleMove);
              resizer.removeEventListener("pointerup", handleUp);
            };
            window.addEventListener("pointermove", handleMove);
            window.addEventListener("pointerup", handleUp, { once: true });
            resizer.addEventListener("pointermove", handleMove);
            resizer.addEventListener("pointerup", handleUp, { once: true });
          }}
        />
      ) : null}
    </article>
  );
}

const nodeTypes = { workstation: WorkstationCanvasNode };

function canvasCardStyle(kind: CanvasCardKind) {
  if (kind === "media") return { width: 360, height: 280 };
  if (kind === "knowledge") return { width: 320, height: 190 };
  if (kind === "task") return { width: 300, height: 150 };
  return { width: 280, height: 170 };
}

function nodeDimension(value: unknown, fallback: number) {
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

function stableCanvasNode(node: CanvasNode): CanvasNode {
  const fallback = canvasCardStyle(node.data?.kind ?? "note");
  const { connectionCount: _connectionCount, ...data } = node.data ?? {
    kind: "note" as const,
    title: "未命名便签",
    body: "",
  };
  return {
    id: node.id,
    type: "workstation",
    position: {
      x: nodeDimension(node.position?.x, 0),
      y: nodeDimension(node.position?.y, 0),
    },
    data,
    style: {
      width: Math.min(900, Math.max(180, nodeDimension(node.style?.width ?? node.measured?.width, fallback.width))),
      height: Math.min(720, Math.max(110, nodeDimension(node.style?.height ?? node.measured?.height, fallback.height))),
    },
  };
}

function canvasSide(value: string | null | undefined, fallback: JsonCanvasEdge["fromSide"]) {
  return value === "top" || value === "right" || value === "bottom" || value === "left"
    ? value
    : fallback;
}

function parseTextCard(text = "") {
  const lines = text.trim().split(/\r?\n/);
  const first = lines[0]?.replace(/^#+\s*/, "").trim();
  return {
    title: first || "导入的便签",
    body: lines.slice(1).join("\n").trim(),
  };
}

function CanvasWorkspaceInner({ tasks, notes, darkMode }: CanvasWorkspaceProps) {
  const initial = useMemo(loadCanvas, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState("");
  const [canvasMessage, setCanvasMessage] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ nodes: CanvasNode[]; edges: Edge[]; warnings: string[] } | null>(null);
  const [sourceShelfOpen, setSourceShelfOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiProposal, setAiProposal] = useState<CanvasAiProposal | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<Viewport>(initial.viewport);
  const { fitView, getViewport, screenToFlowPosition, setCenter, setViewport } = useReactFlow<CanvasNode, Edge>();

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? null;
  const sidePanelOpen = Boolean(aiPanelOpen || selectedNode);
  const flowNodes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return nodes.map((node) => ({
      ...node,
      data: { ...node.data, connectionCount: counts.get(node.id) ?? 0 },
    }));
  }, [edges, nodes]);

  const persist = useCallback(
    (nextNodes = nodes, nextEdges = edges, viewport = viewportRef.current) => {
      try {
        window.localStorage.setItem(
          canvasStorageKey,
          JSON.stringify({
            nodes: nextNodes.map(stableCanvasNode),
            edges: nextEdges,
            viewport,
          }),
        );
      } catch {
        setCanvasError("画布自动保存失败。请导出备份，或删除体积过大的旧内容后重试。");
      }
    },
    [edges, nodes],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => persist(), 100);
    return () => window.clearTimeout(timeout);
  }, [persist]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (!files.length) return;
      event.preventDefault();
      void addMediaFiles(files);
    };
    const wrapper = wrapperRef.current;
    wrapper?.addEventListener("paste", handlePaste);
    return () => wrapper?.removeEventListener("paste", handlePaste);
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) {
        setCanvasError("请选择另一个节点建立关系；同一个节点不需要连接到自己。");
        return;
      }
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            id: window.crypto.randomUUID(),
            type: "bezier",
            style: { strokeWidth: 1.4 },
          },
          current,
        ),
      );
      setCanvasError("");
    },
    [setEdges],
  );

  function canvasCenter() {
    const bounds = wrapperRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return screenToFlowPosition({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    });
  }

  function addCard(
    data: CanvasNodeData,
    position?: { x: number; y: number },
  ) {
    if (data.sourceId) {
      const existing = nodes.find((node) => node.data.sourceId === data.sourceId);
      if (existing) {
        setSelectedNodeId(existing.id);
        void fitView({ nodes: [existing], duration: 260, padding: 1.3 });
        return;
      }
    }

    const center = canvasCenter();
    const placementIndex = nodes.length;
    const stageWidth = wrapperRef.current?.getBoundingClientRect().width ?? 900;
    const columnCount = stageWidth < 620 ? 1 : 3;
    const column = placementIndex % columnCount;
    const row = Math.floor(placementIndex / columnCount);
    const cardPosition = position ?? {
      x: center.x - 130 - ((columnCount - 1) * 300) / 2 + column * 300,
      y: center.y - 165 + (row % 3) * 190,
    };
    const id = window.crypto.randomUUID();
    const node: CanvasNode = {
      id,
      type: "workstation",
      position: position
        ? { x: cardPosition.x - 130, y: cardPosition.y - 70 }
        : cardPosition,
      data,
      style: canvasCardStyle(data.kind),
    };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(id);
    setCanvasError("");
    setCanvasMessage("");
  }

  function addBlankNote(position?: { x: number; y: number }) {
    addCard(
      {
        kind: "note",
        title: "新便签",
        body: "写下一个还没决定放在哪里的想法。",
      },
      position,
    );
  }

  async function addMediaFiles(files: FileList | File[], position?: { x: number; y: number }) {
    const list = Array.from(files).slice(0, 20);
    if (!list.length) return;
    if (!window.workstation?.saveMedia) {
      setCanvasError("附件需要在桌面应用中添加；网页版只能导入和导出 Canvas 文件。");
      return;
    }
    setCanvasError("");
    for (const [index, file] of list.entries()) {
      try {
        const media = await window.workstation.saveMedia({ name: file.name, type: file.type, bytes: await file.arrayBuffer() });
        const base = position ?? canvasCenter();
        addCard({
          kind: "media",
          title: file.name.replace(/\.[^.]+$/, "") || file.name,
          body: `${media.mimeType || "文件"} · ${(media.size / 1024 / 1024).toFixed(media.size > 1024 * 1024 ? 1 : 2)} MB`,
          mediaId: media.id,
          mediaUrl: media.url,
          mediaName: media.name,
          mimeType: media.mimeType,
          mediaSize: media.size,
        }, { x: base.x + index * 34, y: base.y + index * 28 });
      } catch (error) {
        setCanvasError(error instanceof Error ? error.message : `无法添加 ${file.name}`);
      }
    }
    setCanvasMessage(`已把 ${list.length} 个附件加入画布。附件保存在工作站本机目录。`);
  }

  function importTask(task: TaskInput) {
    addCard({
      kind: "task",
      title: task.title,
      body: `${task.done ? "已完成" : "未完成"}\n${task.project}`,
      sourceId: `task:${task.id}`,
    });
    setSourceShelfOpen(false);
  }

  function importNote(note: KnowledgeInput) {
    addCard({
      kind: "knowledge",
      title: note.title,
      body: note.excerpt,
      sourceId: `note:${note.path}`,
      sourcePath: note.path,
    });
    setSourceShelfOpen(false);
  }

  function updateSelectedNode(patch: Partial<CanvasNodeData>) {
    if (!selectedNodeId) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId
          ? { ...node, data: { ...node.data, ...patch } }
          : node,
      ),
    );
  }

  function resizeSelectedNode(width: number, height: number) {
    if (!selectedNodeId) return;
    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNodeId
          ? { ...node, style: { ...node.style, width, height, minHeight: undefined } }
          : node,
      ),
    );
  }

  function selectCanvasNode(node: CanvasNode, nodeScreenRight?: number) {
    setSelectedNodeId(node.id);
    const stageBounds = wrapperRef.current?.getBoundingClientRect();
    const willBeCovered = Boolean(
      stageBounds &&
      nodeScreenRight &&
      nodeScreenRight > stageBounds.right - 366,
    );
    if (!willBeCovered) return;
    const width = nodeDimension(node.style?.width ?? node.measured?.width, 280);
    const height = nodeDimension(node.style?.height ?? node.measured?.height, 170);
    const zoom = Math.min(1.1, Math.max(0.72, getViewport().zoom));
    const usableWidth = Math.max(0, (stageBounds?.width ?? 0) - 366);
    const forwardSpace = usableWidth * 0.22 / zoom;
    window.setTimeout(() => {
      void setCenter(node.position.x + width / 2 + forwardSpace, node.position.y + height / 2, {
        zoom,
        duration: 0,
      });
    }, 0);
  }

  function removeUnusedMedia(deletedNodes: CanvasNode[], remainingNodes: CanvasNode[]) {
    if (!window.workstation?.removeMedia) return;
    const remainingIds = new Set(
      remainingNodes.map((node) => node.data.mediaId).filter((id): id is string => Boolean(id)),
    );
    const deletedIds = [...new Set(
      deletedNodes.map((node) => node.data.mediaId).filter((id): id is string => Boolean(id)),
    )].filter((id) => !remainingIds.has(id));
    if (!deletedIds.length) return;
    void Promise.all(deletedIds.map((id) => window.workstation!.removeMedia(id))).catch(() => {
      setCanvasError("卡片已删除，但有附件文件未能清理；可以稍后重启工作站再试。");
    });
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((current) => {
      const deleted = current.filter((node) => node.id === selectedNodeId);
      const remaining = current.filter((node) => node.id !== selectedNodeId);
      removeUnusedMedia(deleted, remaining);
      return remaining;
    });
    setEdges((current) =>
      current.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
  }

  function clearCanvas() {
    removeUnusedMedia(nodes, []);
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    viewportRef.current = defaultViewport;
    void setViewport(defaultViewport, { duration: 200 });
    window.localStorage.removeItem(canvasStorageKey);
    setCanvasMessage("");
    setClearDialogOpen(false);
  }

  function applyTemplate(template: CanvasTemplate) {
    const maxX = nodes.reduce((maximum, node) => {
      const width = nodeDimension(node.style?.width ?? node.measured?.width, 260);
      return Math.max(maximum, node.position.x + width);
    }, 0);
    const offsetX = nodes.length ? maxX + 180 : 0;
    const ids = template.nodes.map(() => window.crypto.randomUUID());
    const templateNodes: CanvasNode[] = template.nodes.map((item, index) => ({
      id: ids[index],
      type: "workstation",
      position: { x: item.position.x + offsetX, y: item.position.y },
      data: item.data,
      style: canvasCardStyle(item.data.kind),
    }));
    const templateEdges: Edge[] = template.edges.map((edge) => ({
      id: window.crypto.randomUUID(),
      source: ids[edge.from],
      target: ids[edge.to],
      label: edge.label,
      type: "bezier",
      sourceHandle: "right",
      targetHandle: "left",
      style: { strokeWidth: 1.4 },
    }));
    setNodes((current) => [...current, ...templateNodes]);
    setEdges((current) => [...current, ...templateEdges]);
    setSelectedNodeId(null);
    setCanvasError("");
    setCanvasMessage(
      nodes.length
        ? `已把“${template.title}”添加到当前画布右侧，原有卡片保持不变。`
        : `已创建“${template.title}”实验画布。请用真实内容替换模板文字。`,
    );
    setTemplateDialogOpen(false);
    window.setTimeout(
      () => void fitView({ nodes: templateNodes, padding: 0.25, duration: 260 }),
      0,
    );
  }

  function arrangeCanvas() {
    if (nodes.length < 2) {
      setCanvasMessage("至少需要两个节点才能自动整理。");
      return;
    }
    const nodeIds = new Set(nodes.map((node) => node.id));
    const incoming = new Map(nodes.map((node) => [node.id, 0]));
    const outgoing = new Map<string, string[]>();
    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
      incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
      outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    }
    const queue = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((node) => node.id);
    if (!queue.length) queue.push(nodes[0].id);
    const levels = new Map<string, number>(queue.map((id) => [id, 0]));
    const remainingIncoming = new Map(incoming);
    while (queue.length) {
      const source = queue.shift()!;
      const sourceLevel = levels.get(source) ?? 0;
      for (const target of outgoing.get(source) ?? []) {
        levels.set(target, Math.max(levels.get(target) ?? 0, sourceLevel + 1));
        remainingIncoming.set(target, Math.max(0, (remainingIncoming.get(target) ?? 1) - 1));
        if (remainingIncoming.get(target) === 0) queue.push(target);
      }
    }
    let unresolvedLevel = Math.max(0, ...levels.values()) + 1;
    for (const node of nodes) {
      if (!levels.has(node.id)) levels.set(node.id, unresolvedLevel++);
    }
    const columns = new Map<number, CanvasNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.id) ?? 0;
      columns.set(level, [...(columns.get(level) ?? []), node]);
    }
    const levelWidths = new Map<number, number>();
    const levelHeights = new Map<number, number>();
    for (const [level, column] of columns) {
      levelWidths.set(level, Math.max(...column.map((node) => nodeDimension(node.style?.width ?? node.measured?.width, 280))));
      levelHeights.set(level, column.reduce((height, node) => height + nodeDimension(node.style?.height ?? node.measured?.height, 170), 0) + Math.max(0, column.length - 1) * 84);
    }
    const sortedLevels = [...columns.keys()].sort((left, right) => left - right);
    const levelX = new Map<number, number>();
    let currentX = 0;
    for (const level of sortedLevels) {
      levelX.set(level, currentX);
      currentX += (levelWidths.get(level) ?? 280) + 96;
    }
    const columnY = new Map<number, number>();
    const nextNodes = nodes.map((node) => {
      const level = levels.get(node.id) ?? 0;
      const height = nodeDimension(node.style?.height ?? node.measured?.height, 170);
      const totalHeight = levelHeights.get(level) ?? height;
      const y = (columnY.get(level) ?? -totalHeight / 2);
      columnY.set(level, y + height + 56);
      return { ...node, position: { x: levelX.get(level) ?? 0, y } };
    });
    setNodes(nextNodes);
    setCanvasError("");
    setCanvasMessage("已按关系方向重新排列节点；一个节点仍可连接多个分支。");
    window.setTimeout(() => {
      const focusedNode = selectedNodeId
        ? nextNodes.find((node) => node.id === selectedNodeId)
        : null;
      if (focusedNode) {
        const width = nodeDimension(focusedNode.style?.width ?? focusedNode.measured?.width, 280);
        const height = nodeDimension(focusedNode.style?.height ?? focusedNode.measured?.height, 170);
        const zoom = Math.min(0.98, Math.max(0.72, getViewport().zoom));
        const usableWidth = Math.max(0, (wrapperRef.current?.clientWidth ?? 0) - 366);
        const forwardSpace = usableWidth * 0.22 / zoom;
        void setCenter(
          focusedNode.position.x + width / 2 + forwardSpace,
          focusedNode.position.y + height / 2,
          { zoom, duration: 300 },
        );
        return;
      }
      void fitView({ nodes: nextNodes, padding: 0.18, duration: 360 });
    }, 0);
  }

  async function generateCanvasProposal() {
    const requestText = aiPrompt.trim();
    if (!requestText) {
      setCanvasError("先告诉画布 AI 你希望补充或拆解什么。");
      return;
    }
    const titleById = new Map(nodes.map((node) => [node.id, node.data.title]));
    setAiGenerating(true);
    setCanvasError("");
    setCanvasMessage("");
    try {
      const response = await fetch("/api/ai/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: requestText,
          nodes: nodes.map((node) => ({
            title: node.data.title,
            body: node.data.body,
            kind: node.data.kind,
            selected: node.id === selectedNodeId,
          })),
          edges: edges.map((edge) => ({
            source: titleById.get(edge.source) ?? edge.source,
            target: titleById.get(edge.target) ?? edge.target,
          })),
        }),
      });
      const result = (await response.json()) as CanvasAiProposal & { ok?: boolean; error?: string };
      if (!response.ok || !result.ok || !Array.isArray(result.nodes)) {
        throw new Error(result.error ?? "画布 AI 没有返回可用建议");
      }
      setAiProposal({ summary: result.summary, nodes: result.nodes });
    } catch (error) {
      setCanvasError(error instanceof Error ? error.message : "画布 AI 生成失败");
    } finally {
      setAiGenerating(false);
    }
  }

  function applyCanvasProposal() {
    if (!aiProposal?.nodes.length) return;
    const existingTitles = new Set(nodes.map((node) => node.data.title.trim().toLocaleLowerCase()));
    const base = selectedNode
      ? { x: selectedNode.position.x + 340, y: selectedNode.position.y }
      : canvasCenter();
    const additions: CanvasNode[] = [];
    const titleMap = new Map(nodes.map((node) => [node.data.title.trim(), node]));
    const siblingCounts = new Map<string, number>();

    for (const proposalNode of aiProposal.nodes) {
      const normalizedTitle = proposalNode.title.trim().toLocaleLowerCase();
      if (!normalizedTitle || existingTitles.has(normalizedTitle)) continue;
      const parent = proposalNode.parentTitle ? titleMap.get(proposalNode.parentTitle.trim()) : null;
      const siblingKey = parent?.id ?? "root";
      const siblingIndex = siblingCounts.get(siblingKey) ?? 0;
      siblingCounts.set(siblingKey, siblingIndex + 1);
      const position = parent
        ? {
            x: parent.position.x + 340,
            y: parent.position.y + (siblingIndex - 1) * 190,
          }
        : {
            x: base.x - 130 + (siblingIndex % 3) * 310,
            y: base.y - 70 + Math.floor(siblingIndex / 3) * 190,
          };
      const node: CanvasNode = {
        id: window.crypto.randomUUID(),
        type: "workstation",
        position,
        data: {
          kind: proposalNode.kind,
          title: proposalNode.title.trim(),
          body: proposalNode.body.trim(),
        },
        style: canvasCardStyle(proposalNode.kind),
      };
      additions.push(node);
      existingTitles.add(normalizedTitle);
      titleMap.set(node.data.title, node);
    }

    const nextEdges: Edge[] = [];
    for (const proposalNode of aiProposal.nodes) {
      if (!proposalNode.parentTitle) continue;
      const source = titleMap.get(proposalNode.parentTitle.trim());
      const target = titleMap.get(proposalNode.title.trim());
      if (!source || !target || source.id === target.id) continue;
      const vertical = Math.abs(target.position.y - source.position.y) > Math.abs(target.position.x - source.position.x);
      const goesForward = vertical
        ? target.position.y >= source.position.y
        : target.position.x >= source.position.x;
      nextEdges.push({
        id: window.crypto.randomUUID(),
        source: source.id,
        target: target.id,
        sourceHandle: vertical ? (goesForward ? "bottom" : "top") : (goesForward ? "right" : "left"),
        targetHandle: vertical ? (goesForward ? "top" : "bottom") : (goesForward ? "left" : "right"),
        type: "bezier",
        style: { strokeWidth: 1.4 },
      });
    }

    if (!additions.length) {
      setCanvasError("AI 建议中的节点都已经存在，画布没有发生变化。");
      return;
    }
    setNodes((current) => [...current, ...additions]);
    setEdges((current) => [...current, ...nextEdges]);
    setAiProposal(null);
    setAiPrompt("");
    setAiPanelOpen(false);
    setCanvasError("");
    setCanvasMessage(`已加入 ${additions.length} 个 AI 建议节点和 ${nextEdges.length} 条关系。`);
    window.setTimeout(() => void fitView({ nodes: additions, padding: 0.35, duration: 360 }), 0);
  }

  function exportJsonCanvas() {
    if (!nodes.length) return;
    const jsonCanvas: JsonCanvas = {
      nodes: nodes.map((node) => {
        const width = nodeDimension(node.style?.width ?? node.measured?.width, 260);
        const height = nodeDimension(node.style?.height ?? node.measured?.height, 160);
        const base = {
          id: node.id,
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
          width,
          height,
        };
        if (node.data.kind === "knowledge" && node.data.sourcePath) {
          return { ...base, type: "file" as const, file: node.data.sourcePath };
        }
        if (node.data.kind === "link" && node.data.body.startsWith("http")) {
          return { ...base, type: "link" as const, url: node.data.body };
        }
        return {
          ...base,
          type: "text" as const,
          text: `# ${node.data.title}${node.data.body ? `\n\n${node.data.body}` : ""}`,
        };
      }),
      edges: edges.map((edge) => ({
        id: edge.id,
        fromNode: edge.source,
        toNode: edge.target,
        fromSide: canvasSide(edge.sourceHandle, "right"),
        toSide: canvasSide(edge.targetHandle, "left"),
        toEnd: "arrow",
        label: typeof edge.label === "string" ? edge.label : undefined,
      })),
    };

    const blob = new Blob([JSON.stringify(jsonCanvas, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "creator-workstation.canvas";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJsonCanvas(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5_000_000) {
      setCanvasError("Canvas 文件超过 5 MB，暂不导入。");
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as JsonCanvas;
      if (!Array.isArray(parsed.nodes) || parsed.nodes.length > 1000) {
        throw new Error("Canvas 节点格式无效或数量超过 1000 个");
      }

      const importedNodes: CanvasNode[] = parsed.nodes.map((item) => {
        if (!item.id || !item.type) throw new Error("Canvas 中存在缺少 ID 的节点");
        let data: CanvasNodeData;
        if (item.type === "file") {
          const path = item.file ?? "未知文件";
          data = {
            kind: "knowledge",
            title: path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") || "知识卡",
            body: path,
            sourceId: `note:${path}`,
            sourcePath: path,
          };
        } else if (item.type === "link") {
          const url = item.url ?? "";
          data = { kind: "link", title: "链接", body: url };
        } else if (item.type === "group") {
          data = { kind: "note", title: item.label || "分组", body: "来自 Canvas 分组" };
        } else {
          const textCard = parseTextCard(item.text);
          data = { kind: "note", ...textCard };
        }

        return {
          id: item.id,
          type: "workstation",
          position: { x: Number(item.x) || 0, y: Number(item.y) || 0 },
          data,
          style: {
            width: Math.min(640, Math.max(180, Number(item.width) || 260)),
            height: Math.min(720, Math.max(110, Number(item.height) || 170)),
          },
        };
      });

      const nodeIds = new Set(importedNodes.map((node) => node.id));
      const importedEdges: Edge[] = (parsed.edges ?? [])
        .filter(
          (edge) =>
            edge.id && nodeIds.has(edge.fromNode) && nodeIds.has(edge.toNode),
        )
        .slice(0, 2000)
        .map((edge) => ({
          id: edge.id,
          source: edge.fromNode,
          target: edge.toNode,
          label: edge.label,
          type: "bezier",
          sourceHandle: edge.fromSide ?? "right",
          targetHandle: edge.toSide ?? "left",
          style: { strokeWidth: 1.4 },
        }));

      const warnings = [
        parsed.nodes.some((node) => node.type === "file") ? "文件节点将保留路径，但只有工作站本机添加的附件可以直接预览。" : "",
        parsed.nodes.some((node) => node.type === "group") ? "分组节点会转换为普通说明卡。" : "",
      ].filter(Boolean);
      setPendingImport({ nodes: importedNodes, edges: importedEdges, warnings });
      setImportDialogOpen(true);
      setCanvasError("");
    } catch (error) {
      setCanvasError(error instanceof Error ? error.message : "Canvas 文件读取失败");
    }
  }

  function confirmCanvasImport() {
    if (!pendingImport) return;
    setNodes(pendingImport.nodes);
    setEdges(pendingImport.edges);
    setSelectedNodeId(null);
    setImportDialogOpen(false);
    setCanvasMessage(`已导入 ${pendingImport.nodes.length} 个节点、${pendingImport.edges.length} 条关系。`);
    const nextNodes = pendingImport.nodes;
    setPendingImport(null);
    window.setTimeout(() => void fitView({ nodes: nextNodes, padding: 0.3, duration: 260 }), 0);
  }

  return (
    <section className={`canvas-page ${darkMode ? "canvas-theme-dark" : "canvas-theme-light"}${sidePanelOpen ? " canvas-side-panel-open" : ""}`} aria-label="无限画布">
      <header className="canvas-page-heading">
        <div className="canvas-board-title">
          <span aria-hidden="true"><Board24Regular /></span>
          <div>
            <h1>无限画布</h1>
            <p>{nodes.length} 个节点 · {edges.length} 条关系 · 本机自动保存</p>
          </div>
        </div>
        <div className="canvas-heading-actions">
          <Button
            appearance={sourceShelfOpen ? "primary" : "subtle"}
            icon={<Document24Regular />}
            onClick={() => setSourceShelfOpen((current) => !current)}
          >
            素材
          </Button>
          <Button appearance="subtle" icon={<ZoomFit24Regular />} disabled={!nodes.length} onClick={arrangeCanvas}>
            整理
          </Button>
          <Button appearance={aiPanelOpen ? "primary" : "subtle"} icon={<Lightbulb24Regular />} onClick={() => setAiPanelOpen((current) => !current)}>
            画布 AI
          </Button>
          <Button appearance="subtle" icon={<Board24Regular />} onClick={() => setTemplateDialogOpen(true)}>
            模板
          </Button>
          {window.workstation?.saveMedia ? (
            <Button appearance="subtle" icon={<Attach24Regular />} onClick={() => mediaInputRef.current?.click()}>
              媒体
            </Button>
          ) : null}
          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button appearance="subtle" icon={<MoreHorizontal24Regular />} aria-label="更多画布操作" title="更多画布操作" />
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem icon={<ArrowUpload24Regular />} onClick={() => fileInputRef.current?.click()}>
                  导入 Canvas
                </MenuItem>
                <MenuItem icon={<ArrowDownload24Regular />} disabled={!nodes.length} onClick={exportJsonCanvas}>
                  导出 Canvas
                </MenuItem>
                <MenuItem icon={<Delete24Regular />} disabled={!nodes.length} onClick={() => setClearDialogOpen(true)}>
                  清空画布
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
          <input
            ref={fileInputRef}
            className="canvas-file-input"
            type="file"
            accept=".canvas,application/json"
            onChange={(event) => void importJsonCanvas(event)}
          />
          <input
            ref={mediaInputRef}
            className="canvas-file-input"
            type="file"
            multiple
            accept="image/*,video/*,audio/*,application/pdf,.txt,.md"
            onChange={(event) => {
              if (event.target.files) void addMediaFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </header>

      {canvasError ? (
        <MessageBar intent="error">
          <MessageBarBody>{canvasError}</MessageBarBody>
        </MessageBar>
      ) : canvasMessage ? (
        <MessageBar intent="success">
          <MessageBarBody>{canvasMessage}</MessageBarBody>
        </MessageBar>
      ) : null}

      <div className="canvas-workspace-shell">
        <aside className={`canvas-source-shelf${sourceShelfOpen ? " open" : ""}`} aria-label="画布素材">
          <div className="canvas-shelf-heading">
            <div>
              <strong>可接入素材</strong>
              <span>点击即可放到画布中央</span>
            </div>
            <div className="canvas-shelf-actions">
              <Button
                appearance="primary"
                size="small"
                icon={<NoteAdd24Regular />}
                title="添加空白便签"
                onClick={() => addBlankNote()}
              >
                便签
              </Button>
              <Button appearance="subtle" size="small" onClick={() => setSourceShelfOpen(false)}>
                收起
              </Button>
            </div>
          </div>

          <div className="canvas-source-group">
            <span className="canvas-source-label">目标任务</span>
            {tasks.length ? (
              tasks.slice(0, 5).map((task) => (
                <button
                  className="canvas-source-item"
                  key={task.id}
                  onClick={() => importTask(task)}
                >
                  <TargetArrow24Regular aria-hidden="true" />
                  <span>
                    <strong>{task.title}</strong>
                    <small>{task.done ? "已完成" : task.project}</small>
                  </span>
                  <Add24Regular aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="canvas-source-empty">暂无真实任务。</p>
            )}
          </div>

          <div className="canvas-source-group">
            <span className="canvas-source-label">知识库</span>
            {notes.length ? (
              notes.slice(0, 5).map((note) => (
                <button
                  className="canvas-source-item"
                  key={note.path}
                  onClick={() => importNote(note)}
                >
                  <Document24Regular aria-hidden="true" />
                  <span>
                    <strong>{note.title}</strong>
                    <small>{note.path}</small>
                  </span>
                  <Add24Regular aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="canvas-source-empty">连接 Vault 后会显示笔记。</p>
            )}
          </div>
        </aside>

        <div className="canvas-stage" ref={wrapperRef}>
          <ReactFlow<CanvasNode, Edge>
            nodes={flowNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodesDelete={(deletedNodes) => {
              const deletedIds = new Set(deletedNodes.map((node) => node.id));
              removeUnusedMedia(deletedNodes, nodes.filter((node) => !deletedIds.has(node.id)));
              if (selectedNodeId && deletedIds.has(selectedNodeId)) setSelectedNodeId(null);
            }}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(event, node) => {
              const nodeElement = event.target instanceof Element
                ? event.target.closest<HTMLElement>(".react-flow__node")
                : null;
              selectCanvasNode(node, nodeElement?.getBoundingClientRect().right);
            }}
            onPaneClick={() => setSelectedNodeId(null)}
            onDragOver={(event) => {
              if (event.dataTransfer.types.includes("Files")) event.preventDefault();
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.files.length) return;
              event.preventDefault();
              void addMediaFiles(event.dataTransfer.files, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
            }}
            onDoubleClick={(event) => {
              if (
                event.target instanceof Element &&
                event.target.closest(".react-flow__node")
              ) {
                return;
              }
              addBlankNote(
                screenToFlowPosition({ x: event.clientX, y: event.clientY }),
              );
            }}
            onMoveEnd={(_, viewport) => {
              viewportRef.current = viewport;
              persist(nodes, edges, viewport);
            }}
            defaultViewport={initial.viewport}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{
              type: "bezier",
              style: { strokeWidth: 1.4 },
            }}
            minZoom={0.15}
            maxZoom={2.5}
            zoomOnDoubleClick={false}
            deleteKeyCode={["Backspace", "Delete"]}
            selectionKeyCode="Shift"
            multiSelectionKeyCode={["Meta", "Control"]}
            colorMode={darkMode ? "dark" : "light"}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={22}
              size={1.2}
              color="var(--canvas-dot)"
            />
            <Controls position="bottom-left" showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              nodeColor={(node) => {
                if (node.data.kind === "task") return "#0f6cbd";
                if (node.data.kind === "knowledge") return "#0f7b6c";
                if (node.data.kind === "link") return "#7a4f01";
                return "#6b6b6b";
              }}
            />
          </ReactFlow>

          <div
            className="canvas-stage-toolbar nodrag nopan nowheel"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Button
              size="small"
              appearance="secondary"
              icon={<NoteAdd24Regular />}
              onClick={() => addBlankNote()}
            >
              新建便签
            </Button>
            <Button
              size="small"
              appearance="secondary"
              icon={<ZoomFit24Regular />}
              aria-label="显示全部卡片"
              title="显示全部卡片"
              onClick={() => void fitView({ padding: 0.25, duration: 260 })}
            />
          </div>

          {!nodes.length ? (
            <div className="canvas-empty-state">
              <Board24Regular aria-hidden="true" />
              <strong>用一个真实问题开始</strong>
              <p>选择实验模板，或从空白便签自由搭建。两种方式都只保存在本机。</p>
              <div className="canvas-template-grid">
                {canvasTemplates.slice(0, 4).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="canvas-template-thumb"
                    onClick={() => applyTemplate(template)}
                    title={`应用「${template.title}」模板`}
                  >
                    <span className="canvas-template-thumb-icon" aria-hidden="true">
                      {template.icon}
                    </span>
                    <strong>{template.title}</strong>
                    <small>{template.description}</small>
                    <code>{template.relation}</code>
                  </button>
                ))}
              </div>
              <div className="canvas-empty-actions">
                <Button appearance="primary" onClick={() => setTemplateDialogOpen(true)}>
                  查看全部模板
                </Button>
                <Button onClick={() => addBlankNote()}>
                  创建空白便签
                </Button>
              </div>
            </div>
          ) : null}

          {selectedNode && !aiPanelOpen ? (
            <aside className="canvas-inspector" aria-label="卡片编辑器">
              <div className="canvas-inspector-heading">
                  <div>
                    <strong>编辑卡片</strong>
                    <span>{kindLabels[selectedNode.data.kind]}</span>
                  </div>
                <div className="canvas-inspector-actions">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Delete24Regular />}
                    onClick={deleteSelectedNode}
                  >
                    删除
                  </Button>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Dismiss24Regular />}
                    aria-label="收起卡片编辑器"
                    title="收起卡片编辑器"
                    onClick={() => setSelectedNodeId(null)}
                  />
                </div>
              </div>
              <Field label="标题">
                <Input
                  value={selectedNode.data.title}
                  onChange={(_, data) => updateSelectedNode({ title: data.value })}
                />
              </Field>
              <Field label="正文">
                <Textarea
                  value={selectedNode.data.body}
                  rows={5}
                  resize="vertical"
                  onChange={(_, data) => updateSelectedNode({ body: data.value })}
                />
              </Field>
              <div className="canvas-size-controls">
                <span>卡片大小</span>
                <div>
                  <button type="button" onClick={() => resizeSelectedNode(240, 140)}>紧凑</button>
                  <button type="button" onClick={() => resizeSelectedNode(320, 200)}>标准</button>
                  <button type="button" onClick={() => resizeSelectedNode(480, 300)}>宽幅</button>
                </div>
                <small>
                  当前 {nodeDimension(selectedNode.style?.width ?? selectedNode.measured?.width, 280)} × {nodeDimension(selectedNode.style?.height ?? selectedNode.measured?.height, 170)}，也可以拖动卡片四角自由缩放。
                </small>
              </div>
              {selectedNode.data.sourcePath ? (
                <div className="canvas-inspector-source">
                  <span>来源</span>
                  <code>{selectedNode.data.sourcePath}</code>
                </div>
              ) : null}
            </aside>
          ) : null}

          {aiPanelOpen ? (
            <aside className="canvas-ai-panel" aria-label="画布 AI">
              <div className="canvas-ai-heading">
                <div>
                <span aria-hidden="true"><Lightbulb24Regular /></span>
                  <div>
                    <strong>画布 AI</strong>
                    <small>先建议，确认后加入</small>
                  </div>
                </div>
                <Button appearance="subtle" size="small" onClick={() => setAiPanelOpen(false)}>
                  收起
                </Button>
              </div>
              <p>
                {selectedNode
                  ? `当前以“${selectedNode.data.title}”为重点，也会读取画布上的其他节点和关系。`
                  : "AI 会读取当前画布上的节点和关系，为你补充分支或生成结构。"}
              </p>
              <div className="canvas-ai-quick-prompts">
                {[
                  "围绕选中节点补充 4 个具体分支",
                  "找出当前结构缺少的环节",
                  "把这个主题拆成可以执行的内容流程",
                ].map((prompt) => (
                  <button key={prompt} onClick={() => setAiPrompt(prompt)}>{prompt}</button>
                ))}
              </div>
              <Textarea
                value={aiPrompt}
                rows={4}
                resize="vertical"
                placeholder="例如：围绕这个选题，补充受众、核心冲突、素材来源和下一步验证"
                onChange={(_, data) => {
                  setAiPrompt(data.value);
                  setCanvasError("");
                }}
              />
              <Button
                appearance="primary"
                icon={<Lightbulb24Regular />}
                disabled={aiGenerating || !aiPrompt.trim()}
                onClick={() => void generateCanvasProposal()}
              >
                {aiGenerating ? "正在分析画布" : "生成建议"}
              </Button>
              {aiProposal ? (
                <section className="canvas-ai-proposal">
                  <div>
                    <strong>{aiProposal.summary}</strong>
                    <span>{aiProposal.nodes.length} 个建议节点</span>
                  </div>
                  <ul>
                    {aiProposal.nodes.map((node, index) => (
                      <li key={`${node.title}-${index}`}>
                        <Checkmark24Regular aria-hidden="true" />
                        <span>
                          <strong>{node.title}</strong>
                          <small>{node.parentTitle ? `连接到：${node.parentTitle}` : kindLabels[node.kind]}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="canvas-ai-proposal-actions">
                    <Button appearance="subtle" onClick={() => setAiProposal(null)}>放弃</Button>
                    <Button appearance="primary" onClick={applyCanvasProposal}>确认加入画布</Button>
                  </div>
                </section>
              ) : null}
            </aside>
          ) : null}
        </div>
      </div>

      <footer className="canvas-help-row">
        <span>拖动空白处平移，滚轮缩放，拖动卡片两侧连接点创建关系。</span>
        <span>本机自动保存，可导出为 Obsidian 使用的 JSON Canvas。</span>
      </footer>

      <Dialog
        open={templateDialogOpen}
        onOpenChange={(_, data) => setTemplateDialogOpen(data.open)}
      >
        <DialogSurface className="canvas-template-surface">
          <DialogBody>
            <DialogTitle>选择第一张真实画布</DialogTitle>
            <DialogContent>
              <div className="canvas-template-intro">
                <p>
                  模板只提供起点，不决定画布的长期用途。创建后可以自由改字、移动、连线和删除。
                </p>
                {nodes.length ? (
                  <MessageBar intent="info">
                    <MessageBarBody>新模板会添加到当前画布右侧，不会清空已有卡片。</MessageBarBody>
                  </MessageBar>
                ) : null}
              </div>
              <div className="canvas-template-list">
                {canvasTemplates.map((template) => (
                  <button
                    key={template.id}
                    className="canvas-template-option"
                    onClick={() => applyTemplate(template)}
                  >
                    <span className="canvas-template-icon" aria-hidden="true">
                      {template.icon}
                    </span>
                    <span className="canvas-template-copy">
                      <strong>{template.title}</strong>
                      <small>{template.description}</small>
                      <code>{template.relation}</code>
                    </span>
                    <span className="canvas-template-count">
                      {template.nodes.length} 张卡片
                    </span>
                  </button>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setTemplateDialogOpen(false)}>取消</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={clearDialogOpen} onOpenChange={(_, data) => setClearDialogOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>清空当前画布？</DialogTitle>
            <DialogContent>
              这会删除本机画布中的全部卡片和连线，不会删除任务或 Obsidian 笔记。
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setClearDialogOpen(false)}>取消</Button>
              <Button appearance="primary" onClick={clearCanvas}>
                确认清空
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={(_, data) => {
        setImportDialogOpen(data.open);
        if (!data.open) setPendingImport(null);
      }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>导入并替换当前画布？</DialogTitle>
            <DialogContent>
              <div className="settings-stack">
                <p>将导入 {pendingImport?.nodes.length ?? 0} 个节点和 {pendingImport?.edges.length ?? 0} 条关系。当前画布会被替换，建议先导出备份。</p>
                {pendingImport?.warnings.map((warning) => (
                  <MessageBar intent="warning" key={warning}><MessageBarBody>{warning}</MessageBarBody></MessageBar>
                ))}
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setImportDialogOpen(false)}>取消</Button>
              <Button appearance="primary" onClick={confirmCanvasImport}>确认替换</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </section>
  );
}

export function CanvasWorkspace(props: CanvasWorkspaceProps) {
  return (
    <ReactFlowProvider>
      <CanvasWorkspaceInner {...props} />
    </ReactFlowProvider>
  );
}
