import { 
  Badge,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
 } from "@fluentui/react-components";
import { Document24Regular, Open24Regular, Search24Regular } from "@fluentui/react-icons";
import { KnowledgeCalibration } from "../KnowledgeCalibration";
import { formatCaptureTime } from "../lib/format";

import type { WorkstationStore } from "../useWorkstationStore";
import { CaptureComposer } from "./CaptureComposer";

export function KnowledgeView({ store }: { store: WorkstationStore }) {
  const { vaultError, vaultStatus, knowledgeQuery, setKnowledgeQuery, setSettingsOpen, knowledgeNotes, knowledgeError, knowledgeLoading, obsidianUri, captureTotal, capturesLoading, captures, captureError, writeMessage, knowledgeCalibrationOpen, setKnowledgeCalibrationOpen, useCalibrationQuestion, changeView, searchKnowledge, resolveCapture } = store;
    return (
      <section className="page-section knowledge-page">
        <div className="page-heading">
          <div>
            <p className="date-label">知识库</p>
            <h1>搜索 Obsidian，也把新内容送回 Inbox。</h1>
            <p>搜索只读取 Markdown；快速捕获仍会先显示写入预览。</p>
          </div>
          <Badge appearance="tint" color={vaultError ? "warning" : vaultStatus?.mode === "configured" ? "success" : "informative"}>
            {vaultError ? "连接失败" : vaultStatus?.mode === "configured" ? "真实 Vault" : vaultStatus ? "演示知识库" : "正在连接"}
          </Badge>
        </div>

        <section className="work-section knowledge-search-panel">
          <div className="knowledge-search-row">
            <Field label="搜索知识库">
              <Input
                contentBefore={<Search24Regular />}
                value={knowledgeQuery}
                onChange={(_, data) => setKnowledgeQuery(data.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) void searchKnowledge();
                }}
                placeholder="输入标题、关键词或笔记内容"
              />
            </Field>
            <Button appearance="primary" onClick={() => void searchKnowledge()}>
              搜索
            </Button>
            {knowledgeQuery ? (
              <Button
                onClick={() => {
                  setKnowledgeQuery("");
                  void searchKnowledge("");
                }}
              >
                清除
              </Button>
            ) : null}
          </div>
          <div className="vault-path-row">
            <span>{vaultStatus?.mode === "configured" ? "当前私人知识库" : "当前内容来源"}</span>
            <strong>{vaultStatus?.vaultName ?? "正在连接"}</strong>
            {vaultStatus?.mode === "configured" ? <code title={vaultStatus.vaultPath}>{vaultStatus.vaultPath}</code> : <small>示例内容不会当作你的私人资料。</small>}
            {vaultError ? <Button size="small" onClick={() => setSettingsOpen(true)}>重新连接</Button> : null}
          </div>
        </section>

        <div className="knowledge-layout">
          <section className="work-section note-results">
            <div className="section-heading">
              <div>
                <h2>{knowledgeQuery ? "搜索结果" : "最近更新"}</h2>
                <p>最多读取 500 篇 Markdown，单篇不超过 1 MB。</p>
              </div>
              <Badge appearance="outline">{knowledgeNotes.length} 篇</Badge>
            </div>
            {knowledgeError ? (
              <MessageBar intent="error">
                <MessageBarBody>{knowledgeError}</MessageBarBody>
              </MessageBar>
            ) : knowledgeLoading ? (
              <div className="skeleton-list" aria-label="正在搜索知识库">
                <span />
                <span />
                <span />
              </div>
            ) : knowledgeNotes.length ? (
              <div className="note-list">
                {knowledgeNotes.map((note) => (
                  <article className="note-row" key={note.path}>
                    <Document24Regular aria-hidden="true" />
                    <div>
                      <h3>{note.title}</h3>
                      <p>{note.excerpt}</p>
                      <div className="note-meta">
                        <code>{note.path}</code>
                        <time dateTime={note.modifiedAt}>
                          {formatCaptureTime(note.modifiedAt)}
                        </time>
                      </div>
                    </div>
                    {vaultStatus?.mode === "configured" ? (
                      <a href={obsidianUri(note.path)}>
                        在 Obsidian 打开 <Open24Regular aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="demo-note-label">Demo 笔记</span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search24Regular aria-hidden="true" />
                <strong>没有找到匹配笔记</strong>
                <p>换一个关键词，或先在右侧捕获新内容。</p>
              </div>
            )}
          </section>

          <div className="knowledge-side">
            {<CaptureComposer store={store} compact />}
            <section className="work-section capture-history">
              <div className="section-heading">
                <div>
                  <h2>最近捕获</h2>
                  <p>来自 Inbox/Capture.md。</p>
                </div>
                <Badge appearance="outline">{captureTotal} 条</Badge>
              </div>
              {capturesLoading ? (
                <div className="skeleton-list"><span /><span /></div>
              ) : captures.length ? (
                <div className="capture-list">
                  {captures.slice(0, 5).map((entry, index) => (
                    <article className="capture-row" key={`${entry.createdAt}-${index}`}>
                      <Document24Regular aria-hidden="true" />
                      <div>
                        <p>{entry.text}</p>
                        <time dateTime={entry.createdAt}>
                          {formatCaptureTime(entry.createdAt)}
                        </time>
                        <div className="capture-row-actions">
                          <Button size="small" appearance="subtle" onClick={() => void resolveCapture(entry, "task")}>
                            转为今日任务
                          </Button>
                          <Button size="small" appearance="subtle" onClick={() => void resolveCapture(entry, "archive")}>
                            归档
                          </Button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact-empty">
                  <strong>还没有捕获内容</strong>
                  <p>先写下第一条灵感。</p>
                </div>
              )}
              {captureError ? <MessageBar intent="error"><MessageBarBody>{captureError}</MessageBarBody></MessageBar> : null}
              {writeMessage ? <MessageBar intent="success"><MessageBarBody>{writeMessage}</MessageBarBody></MessageBar> : null}
            </section>
          </div>
        </div>
        <details
          id="knowledge-calibration"
          className="onboarding-disclosure knowledge-calibration-disclosure"
          open={knowledgeCalibrationOpen}
          onToggle={(event) => setKnowledgeCalibrationOpen(event.currentTarget.open)}
        >
          <summary>
            <span>AI 检索校准</span>
            <strong>检查私人管家能否找到正确笔记</strong>
            <small>只有命中的片段会进入模型请求</small>
          </summary>
          <KnowledgeCalibration
            notes={knowledgeNotes}
            vaultName={vaultStatus?.vaultName}
            onUseQuestion={(question) => {
              useCalibrationQuestion(question);
              changeView("ai");
            }}
          />
        </details>
      </section>
    );}
