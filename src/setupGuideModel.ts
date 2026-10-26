export type SetupStepId = "vault" | "task" | "model";

export type SetupStateInput = {
  vaultConfigured: boolean;
  hasRealTask: boolean;
  aiConfigured: boolean;
  aiTested: boolean;
};

export type SetupStepState = {
  id: SetupStepId;
  title: string;
  description: string;
  complete: boolean;
  action: string;
};

export function buildSetupState({
  vaultConfigured,
  hasRealTask,
  aiConfigured,
  aiTested,
}: SetupStateInput) {
  const steps: SetupStepState[] = [
    {
      id: "vault",
      title: "连接你的私人知识库",
      description: vaultConfigured
        ? "真实 Obsidian Vault 已连接，工作站正在读取 Markdown。"
        : "当前仍是 Demo Vault。连接真实目录后，搜索和问答才会使用你的内容。",
      complete: vaultConfigured,
      action: vaultConfigured ? "查看知识库" : "连接 Vault",
    },
    {
      id: "task",
      title: "加入第一项真实任务",
      description: hasRealTask
        ? "首页和数据仪表已经开始使用你的真实任务。"
        : "示例任务不会进入统计。添加一项今天确实要完成的事情。",
      complete: hasRealTask,
      action: hasRealTask ? "查看任务" : "添加任务",
    },
    {
      id: "model",
      title: "接入并验证自己的模型",
      description: aiTested
        ? "模型连接已通过测试，可以开始私人知识库问答。"
        : aiConfigured
          ? "模型配置已保存，再完成一次小请求验证连接。"
          : "选择国内兼容模型，在本机保存 API 地址、模型 ID 和密钥。",
      complete: aiTested,
      action: aiTested ? "打开 AI" : aiConfigured ? "测试连接" : "配置模型",
    },
  ];
  const completedCount = steps.filter((step) => step.complete).length;
  return {
    steps,
    completedCount,
    nextStepId: steps.find((step) => !step.complete)?.id,
  };
}
