# Demo Vault

这个目录只用于验证工作台原型的 Markdown 写入闭环，不代表用户真实的 Obsidian 目录结构。

启动原型后，快速捕获会在用户确认写入预览后追加到 `Inbox/Capture.md`。

连接真实 Vault 时，点击工作站右上角“连接 Obsidian”并粘贴完整文件夹路径；也可以在启动前设置环境变量 `WORKSTATION_VAULT_PATH`。

快速捕获只允许追加到 `Inbox/Capture.md`。用户主动启用任务同步后，工作站还会创建并管理带有专用标记的 `Workstation/Tasks.md`；同名非管理文件不会被覆盖。

知识搜索会只读扫描 Markdown，跳过隐藏目录，不会删除或批量改写其他笔记。
