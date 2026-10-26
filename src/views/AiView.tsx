import { 
  Badge,
  Button,
  MessageBar,
  MessageBarBody,
  Textarea,
 } from "@fluentui/react-components";
import { 
  Checkmark24Regular,
  Copy24Regular,
  Delete24Regular,
  Settings24Regular,
  Wand24Regular,
 } from "@fluentui/react-icons";
import { AssistantGlyph } from "../data/navigation";
import { renderAiMessageContent } from "../lib/markdown";
import { AiMode } from "../types";

import type { WorkstationStore } from "../useWorkstationStore";

export function AiView({ store }: { store: WorkstationStore }) {
  const { buildAuthorizedAiContext, aiContext, aiStatus, openAiConfigDialog, aiMessages, setAiNewChatOpen, resetAiConversation, obsidianUri, describeAgentAction, dismissAgentActions, applyAgentActions, setAiMode, setAiDraft, setAiError, setAiMessage, aiGenerating, aiChatEndRef, aiError, aiMessage, setAiContext, trackedTasks, vaultStatus, captures, aiDraft, aiComposingRef, stopAiGeneration, generateWithModel, copyText } = store;
    const suggestions: Array<{ label: string; prompt: string; mode: AiMode }> = [
      {
        label: "安排今天",
        prompt: "读取我当前的目标任务，帮我排出今天最重要的三件事，并指出可能卡住我的地方。",
        mode: "plan",
      },
      {
        label: "新增目标",
        prompt: "给我新增三个最近目标：第一个是【填写目标】，第二个是【填写目标】，第三个是【填写目标】。",
        mode: "agent",
      },
      {
        label: "复盘问题",
        prompt: "根据最近的任务完成情况，直接指出我哪里做得不好，并给出下一步调整建议。",
        mode: "review",
      },
      {
        label: "按我的风格写",
        prompt: "读取知识库里我以前写过的文章，先总结我的写作风格，再围绕【填写主题】起草一篇新文章。材料不足时直接告诉我。",
        mode: "content",
      },
    ];
    const authorized = buildAuthorizedAiContext();
    const contextSummary = [
      aiContext.today ? `${authorized.tasks.length} 项任务` : null,
      aiContext.knowledge ? `${vaultStatus?.mode === "configured" ? vaultStatus.vaultName : "演示知识库（非私人资料）"}` : null,
      aiContext.inbox ? `${authorized.captures.length} 条收件箱` : null,
    ].filter(Boolean).join(" · ") || "未读取工作站内容";
    const statusColor = aiStatus?.lastTestedAt
      ? "success"
      : aiStatus?.configured
        ? "warning"
        : "informative";

    return (
      <section className="page-section ai-page agent-page">
        <header className="agent-header">
          <div className="agent-title-lockup">
            <span className="agent-mark" aria-hidden="true"><AssistantGlyph /></span>
            <div>
              <p>私人工作站智能体</p>
              <h1>告诉我你想完成什么</h1>
              <span>它能读取当前工作站和命中的知识库片段；修改系统前一定先征求你的确认。</span>
            </div>
          </div>
          <div className="agent-header-actions">
            <Badge appearance="tint" color={statusColor}>
              {aiStatus?.lastTestedAt
                ? `${aiStatus.providerName} 已连接`
                : aiStatus?.configured
                  ? `${aiStatus.providerName} 待测试`
                  : aiStatus
                    ? "尚未配置模型"
                    : "正在读取配置"}
            </Badge>
            <Button appearance="subtle" icon={<Settings24Regular />} onClick={openAiConfigDialog}>
              模型设置
            </Button>
            <Button
              appearance="subtle"
              onClick={() => aiMessages.length > 1 ? setAiNewChatOpen(true) : resetAiConversation()}
            >
              新对话
            </Button>
          </div>
        </header>

        <section className="agent-workspace">
          <main className="agent-conversation" aria-live="polite">
            {aiMessages.map((message) => (
              <article className={`agent-message ${message.role}`} key={message.id}>
                <div className="agent-message-avatar" aria-hidden="true">
                  {message.role === "assistant" ? <AssistantGlyph /> : "黄"}
                </div>
                <div className="agent-message-body">
                  <div className="agent-message-meta">
                    <strong>{message.role === "assistant" ? "工作站管家" : "你"}</strong>
                    {message.usage?.totalTokens ? <span>{message.usage.totalTokens} Tokens</span> : null}
                  </div>
                  <div className="agent-message-text">
                    {renderAiMessageContent(message.content, message.id)}
                  </div>
                  {message.sources?.length ? (
                    <div className="agent-sources">
                      <span>参考了 {message.sources.length} 条本地笔记片段</span>
                      <div>
                        {message.sources.map((source, index) => (
                          <a key={source.id} href={obsidianUri(source.path)}>
                            [{index + 1}] {source.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {message.actions?.length ? (
                    <section className={`agent-action-card ${message.actionState ?? "pending"}`}>
                      <div>
                        <strong>
                          {message.actionState === "applied"
                            ? "更改已执行"
                            : message.actionState === "dismissed"
                              ? "更改已取消"
                              : `准备执行 ${message.actions.length} 项更改`}
                        </strong>
                        <span>{message.actionState === "pending" ? "确认后才会写入工作站" : "这组操作已经处理"}</span>
                      </div>
                      <ul>
                        {message.actions.map((action, index) => (
                          <li key={`${action.type}-${action.title}-${index}`}>
                            <Checkmark24Regular aria-hidden="true" />
                            <span>{describeAgentAction(action)}</span>
                          </li>
                        ))}
                      </ul>
                      {message.actionState === "pending" ? (
                        <div className="agent-action-buttons">
                          <Button appearance="subtle" onClick={() => dismissAgentActions(message.id)}>
                            取消
                          </Button>
                          <Button appearance="primary" onClick={() => applyAgentActions(message.id, message.actions!)}>
                            确认执行
                          </Button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  {message.role === "assistant" && message.id !== "welcome" ? (
                    <Button
                      className="agent-copy-button"
                      appearance="subtle"
                      size="small"
                      icon={<Copy24Regular />}
                      onClick={() => void copyText(message.content, "回答已复制。")}
                    >
                      复制
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}

            {aiMessages.length === 1 ? (
              <div className="agent-suggestions" aria-label="常用示例">
                <span>你可以这样说</span>
                <div>
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      onClick={() => {
                        setAiMode(suggestion.mode);
                        setAiDraft(suggestion.prompt);
                        setAiError("");
                        setAiMessage("");
                        window.setTimeout(() => document.querySelector<HTMLTextAreaElement>(".agent-input textarea")?.focus(), 0);
                      }}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {aiGenerating ? (
              <article className="agent-message assistant pending">
                <div className="agent-message-avatar" aria-hidden="true"><AssistantGlyph /></div>
                <div className="agent-message-body">
                  <div className="agent-message-meta"><strong>工作站管家</strong></div>
                  <div className="ai-typing" aria-label="AI 正在组织回答"><i /><i /><i /></div>
                </div>
              </article>
            ) : null}
            <div ref={aiChatEndRef} />
          </main>

          <footer className="agent-dock">
            {aiError || aiMessage ? (
              <MessageBar intent={aiError ? "error" : "success"}>
                <MessageBarBody>{aiError || aiMessage}</MessageBarBody>
              </MessageBar>
            ) : null}
            <div className="agent-context-bar">
              <span>本次允许读取</span>
              <button
                className={aiContext.today ? "active" : ""}
                aria-pressed={aiContext.today}
                onClick={() => setAiContext((current) => ({ ...current, today: !current.today }))}
              >
                目标任务 · {trackedTasks.length}
              </button>
              <button
                className={aiContext.knowledge ? "active" : ""}
                aria-pressed={aiContext.knowledge}
                onClick={() => setAiContext((current) => ({ ...current, knowledge: !current.knowledge }))}
              >
                知识库 · {vaultStatus?.mode === "configured" ? vaultStatus.vaultName : vaultStatus ? "演示" : "未连接"}
              </button>
              <button
                className={aiContext.inbox ? "active" : ""}
                aria-pressed={aiContext.inbox}
                onClick={() => setAiContext((current) => ({ ...current, inbox: !current.inbox }))}
              >
                收件箱 · {captures.length}
              </button>
            </div>
            <div className="agent-input">
              <Textarea
                value={aiDraft}
                onChange={(_, data) => {
                  setAiDraft(data.value);
                  setAiError("");
                  setAiMessage("");
                }}
                onCompositionStart={() => {
                  aiComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  aiComposingRef.current = false;
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229 &&
                    !aiComposingRef.current &&
                    !aiGenerating
                  ) {
                    event.preventDefault();
                    void generateWithModel();
                  }
                }}
                placeholder="直接说：给我新增三个目标任务；检查我最近哪里做得不好；按我以前的风格写一篇文章……"
                rows={3}
                resize="none"
              />
              <div className="agent-input-footer">
                <div>
                  <span>{contextSummary}</span>
                </div>
                <Button
                  appearance={aiGenerating ? "secondary" : "primary"}
                  icon={aiGenerating ? <Delete24Regular /> : <Wand24Regular />}
                  disabled={!aiGenerating && (!aiStatus?.configured || !aiDraft.trim())}
                  onClick={() => aiGenerating ? stopAiGeneration() : void generateWithModel()}
                >
                {aiGenerating ? "停止" : "发送"}
                </Button>
              </div>
            </div>
            <p className="agent-privacy-note">知识库检索在本机完成，只把命中的片段发给你配置的模型。系统修改会先显示确认卡。</p>
          </footer>
        </section>
      </section>
    );}
