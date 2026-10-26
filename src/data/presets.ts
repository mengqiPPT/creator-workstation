import type { AiChatMessage, AiProviderPreset, CreatorLink, Task } from "../types";

export const initialTasks: Task[] = [
  {
    id: "prototype-loop",
    title: "走通快速捕获到 Markdown 的完整流程",
    project: "工作站配置",
    done: false,
    period: "today",
    demo: true,
  },
  {
    id: "homepage-check",
    title: "选择第一批常用的内容发布后台",
    project: "创作发布",
    done: false,
    period: "today",
    demo: true,
  },
  {
    id: "vault-boundary",
    title: "确认六个核心板块",
    project: "Obsidian 集成",
    done: true,
    period: "recent",
    demo: true,
  },
];

export const defaultCreatorLinks: CreatorLink[] = [
  {
    id: "douyin",
    name: "抖音创作者中心",
    url: "https://creator.douyin.com/",
    description: "发布视频、管理作品与查看创作数据",
    builtIn: true,
  },
  {
    id: "bilibili",
    name: "哔哩哔哩创作中心",
    url: "https://member.bilibili.com/platform/home",
    description: "投稿视频、专栏与查看内容数据",
    builtIn: true,
  },
  {
    id: "xiaohongshu",
    name: "小红书创作服务平台",
    url: "https://creator.xiaohongshu.com/",
    description: "发布笔记、管理合作与创作内容",
    builtIn: true,
  },
  {
    id: "wechat-official",
    name: "微信公众平台",
    url: "https://mp.weixin.qq.com/",
    description: "编辑与发布公众号图文内容",
    builtIn: true,
  },
  {
    id: "wechat-channels",
    name: "视频号助手",
    url: "https://channels.weixin.qq.com/",
    description: "管理视频号内容、直播与数据",
    builtIn: true,
  },
];

export const aiProviderPresets: AiProviderPreset[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-v4-flash",
    keyUrl: "https://platform.deepseek.com/",
    docsUrl: "https://api-docs.deepseek.com/api/create-chat-completion",
    fit: "建议第一次接入先用：配置项最少，适合日常问答、整理和创作草稿。",
    setup: "地址和模型已预填，只需申请并粘贴 API Key。",
    note: "预填 DeepSeek V4 Flash；需要更强推理时可把模型 ID 改为 deepseek-v4-pro。",
  },
  {
    id: "kimi",
    name: "Kimi",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k3",
    keyUrl: "https://platform.kimi.com/",
    docsUrl: "https://platform.kimi.com/docs/api/chat",
    fit: "适合已经习惯 Kimi，或以后希望扩展长文与多模态内容处理。",
    setup: "地址和模型已预填，只需申请并粘贴 API Key。",
    note: "当前工作站先使用文字问答；图片、视频输入可以在后续版本单独开放。",
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5.2",
    keyUrl: "https://bigmodel.cn/",
    docsUrl: "https://docs.bigmodel.cn/cn/guide/start/quick-start",
    fit: "适合复杂任务、长程规划，以及后续扩展智能体工作流。",
    setup: "地址和模型已预填，只需申请并粘贴 API Key。",
    note: "预填官方快速开始使用的 GLM-5.2；账号权限不同时可从控制台复制其他模型 ID。",
  },
  {
    id: "qwen",
    name: "通义千问",
    baseUrl: "",
    model: "qwen-plus",
    keyUrl: "https://help.aliyun.com/zh/model-studio/get-api-key/",
    docsUrl: "https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions",
    fit: "适合已经使用阿里云百炼，或希望沿用百炼工作空间与权限管理。",
    setup: "创建 Key 后，把弹窗同时给出的 API Host 粘贴到下方地址栏。",
    note: "华北 2 等地域的新地址包含 Workspace ID，不能由工作站替你猜测。模型先用稳定别名 qwen-plus。",
  },
  {
    id: "doubao",
    name: "豆包火山方舟",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2-0-lite-260215",
    keyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apikey",
    docsUrl: "https://www.volcengine.com/docs/82379/1795150",
    fit: "适合已经使用火山引擎，或计划把工作站和视频创作工具放在同一平台。",
    setup: "北京地域地址和官方示例模型已预填，申请后粘贴 API Key。",
    note: "如果你的账号使用其他地域或模型，请从方舟控制台复制对应地址与模型 ID。",
  },
  {
    id: "custom",
    name: "自定义兼容接口",
    baseUrl: "",
    model: "",
    keyUrl: "",
    docsUrl: "",
    fit: "适合其他兼容 Chat Completions 的云端服务或本机模型。",
    setup: "需要自行填写显示名称、API 地址、模型 ID 和密钥。",
    note: "工作站会向 API 基础地址下的 /chat/completions 发起请求。",
  },
];

export const defaultAiProvider = aiProviderPresets[0];

export const welcomeAiMessage: AiChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "你好，我是你的工作站管家。直接告诉我你想做什么：管理目标任务、复盘进度、检查问题，或者读取以前的文章并按你的风格起草新内容。涉及修改时，我会先把操作列出来，等你确认后再执行。",
};
