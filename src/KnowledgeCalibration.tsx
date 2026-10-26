import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
} from "@fluentui/react-components";
import {
  ArrowRight24Regular,
  Checkmark24Regular,
  Search24Regular,
} from "@fluentui/react-icons";

type KnowledgeNote = {
  path: string;
  title: string;
};

type KnowledgeSource = {
  id: string;
  path: string;
  title: string;
  excerpt: string;
  modifiedAt: string;
  score: number;
};

type CalibrationRating = "accurate" | "partial" | "missed";

type CalibrationRun = {
  id: string;
  question: string;
  createdAt: string;
  sourcePaths: string[];
  rating?: CalibrationRating;
};

type KnowledgeCalibrationProps = {
  notes: KnowledgeNote[];
  vaultName?: string;
  onUseQuestion: (question: string) => void;
};

const calibrationStorageKey = "workstation.knowledge-calibration.v1";

function loadCalibrationRuns(): CalibrationRun[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(calibrationStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): CalibrationRun[] => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<CalibrationRun>;
      if (typeof candidate.id !== "string" || typeof candidate.question !== "string") return [];
      return [{
        id: candidate.id,
        question: candidate.question.slice(0, 500),
        createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
        sourcePaths: Array.isArray(candidate.sourcePaths)
          ? candidate.sourcePaths.filter((path): path is string => typeof path === "string").slice(0, 8)
          : [],
        rating: ["accurate", "partial", "missed"].includes(candidate.rating ?? "")
          ? candidate.rating
          : undefined,
      }];
    }).slice(0, 20);
  } catch {
    return [];
  }
}

function runId() {
  return globalThis.crypto?.randomUUID?.() ?? `calibration-${Date.now()}`;
}

export function KnowledgeCalibration({
  notes,
  vaultName = "当前 Vault",
  onUseQuestion,
}: KnowledgeCalibrationProps) {
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [runs, setRuns] = useState<CalibrationRun[]>(loadCalibrationRuns);
  const [currentRunId, setCurrentRunId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    window.localStorage.setItem(calibrationStorageKey, JSON.stringify(runs.slice(0, 20)));
  }, [runs]);

  const suggestions = useMemo(() => {
    const titles = notes
      .map((note) => note.title.trim())
      .filter((title, index, all) => title && all.indexOf(title) === index)
      .slice(0, 3);
    if (!titles.length) {
      return [
        "我以前总结过哪些工作站设计原则？",
        "关于最近的创作项目，我做过哪些决定？",
        "我记录过哪些值得复用的内容流程？",
      ];
    }
    return titles.map((title) => `关于「${title}」，我以前记录过哪些关键结论？`);
  }, [notes]);

  const currentRun = runs.find((run) => run.id === currentRunId);
  const ratedRuns = runs.filter((run) => run.rating);
  const accurateCount = ratedRuns.filter((run) => run.rating === "accurate").length;
  const partialCount = ratedRuns.filter((run) => run.rating === "partial").length;
  const missedCount = ratedRuns.filter((run) => run.rating === "missed").length;
  const recommendation = ratedRuns.length < 3
    ? "先完成至少 3 个来自真实工作的测试问题，再判断检索方案。"
    : missedCount > accurateCount + partialCount
      ? "当前关键词检索经常遗漏。下一轮应评估本机向量索引，并检查笔记命名与内容结构。"
      : partialCount > accurateCount
        ? "检索方向基本正确，但上下文不完整。下一轮优先调节分片与候选数量。"
        : "当前本机检索对这些问题表现稳定。先继续积累真实问题，不急着增加向量数据库。";

  async function testRetrieval(candidate = question) {
    const normalized = candidate.trim();
    if (!normalized) {
      setError("请先写一个你最近真的想从知识库找答案的问题。");
      return;
    }
    setQuestion(normalized);
    setLoading(true);
    setError("");
    setSources([]);
    try {
      const response = await fetch("/api/vault/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ query: normalized, limit: 6 }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        sources?: KnowledgeSource[];
        error?: string;
      };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "本机知识检索失败");
      const nextSources = result.sources ?? [];
      const id = runId();
      const run: CalibrationRun = {
        id,
        question: normalized,
        createdAt: new Date().toISOString(),
        sourcePaths: nextSources.map((source) => source.path),
      };
      setSources(nextSources);
      setCurrentRunId(id);
      setRuns((current) => [run, ...current].slice(0, 20));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "本机知识检索失败");
    } finally {
      setLoading(false);
    }
  }

  function rateCurrent(rating: CalibrationRating) {
    if (!currentRunId) return;
    setRuns((current) => current.map((run) =>
      run.id === currentRunId ? { ...run, rating } : run,
    ));
  }

  return (
    <section className="work-section knowledge-calibration" aria-labelledby="knowledge-calibration-title">
      <header className="knowledge-calibration-heading">
        <div>
          <h2 id="knowledge-calibration-title">用真实问题校准私人管家</h2>
          <p>先只测试本机检索。确认找到的笔记确实有用后，再让模型组织答案。</p>
        </div>
        <Badge appearance="outline">{ratedRuns.length} 个问题已评价</Badge>
      </header>

      <div className="knowledge-calibration-layout">
        <div className="knowledge-calibration-input">
          <Field
            label="一个你本来会去翻笔记的问题"
            hint={`检索范围：${vaultName}。问题不会发送给外部模型。`}
            validationMessage={error || undefined}
            validationState={error ? "error" : "none"}
          >
            <Input
              value={question}
              contentBefore={<Search24Regular />}
              placeholder="例如：我以前为什么决定先做本机工作站？"
              onChange={(_, data) => {
                setQuestion(data.value);
                setSources([]);
                setCurrentRunId("");
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !loading && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                  void testRetrieval();
                }
              }}
            />
          </Field>
          <div className="knowledge-calibration-suggestions" aria-label="建议测试问题">
            {suggestions.map((suggestion) => (
              <Button
                appearance="subtle"
                key={suggestion}
                onClick={() => void testRetrieval(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
          <Button
            appearance="primary"
            icon={<Search24Regular />}
            disabled={loading || !question.trim()}
            onClick={() => void testRetrieval()}
          >
            {loading ? "正在本机检索" : "测试这次检索"}
          </Button>
        </div>

        <div className="knowledge-calibration-result" aria-live="polite">
          {loading ? (
            <div className="skeleton-list knowledge-calibration-loading" aria-label="正在检索">
              <span />
              <span />
              <span />
            </div>
          ) : currentRun ? (
            <>
              <div className="knowledge-calibration-result-heading">
                <div>
                  <strong>{sources.length ? `找到 ${sources.length} 个相关片段` : "没有找到相关片段"}</strong>
                  <span>先判断这些来源是否能支持你想要的答案。</span>
                </div>
                {sources.length ? (
                  <Button
                    icon={<ArrowRight24Regular />}
                    iconPosition="after"
                    onClick={() => onUseQuestion(currentRun.question)}
                  >
                    放入知识问答
                  </Button>
                ) : null}
              </div>

              {sources.length ? (
                <div className="knowledge-calibration-source-list">
                  {sources.slice(0, 4).map((source, index) => (
                    <article key={source.id}>
                      <span>[{index + 1}]</span>
                      <div>
                        <strong>{source.title}</strong>
                        <code>{source.path}</code>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <MessageBar intent="warning">
                  <MessageBarBody>换用笔记中的具体名词再试一次。连续多个真实问题都找不到时，再考虑语义向量检索。</MessageBarBody>
                </MessageBar>
              )}

              <div className="knowledge-calibration-rating">
                <span>这次检索：</span>
                <Button
                  appearance={currentRun.rating === "accurate" ? "primary" : "secondary"}
                  icon={<Checkmark24Regular />}
                  onClick={() => rateCurrent("accurate")}
                >
                  命中准确
                </Button>
                <Button
                  appearance={currentRun.rating === "partial" ? "primary" : "secondary"}
                  onClick={() => rateCurrent("partial")}
                >
                  有用但不完整
                </Button>
                <Button
                  appearance={currentRun.rating === "missed" ? "primary" : "secondary"}
                  onClick={() => rateCurrent("missed")}
                >
                  不相关
                </Button>
              </div>
            </>
          ) : (
            <div className="knowledge-calibration-empty">
              <Search24Regular aria-hidden="true" />
              <strong>先用一个真实问题试一次</strong>
              <p>好问题应当来自最近的工作，而且你大致知道答案藏在哪篇笔记里。</p>
            </div>
          )}
        </div>
      </div>

      <footer className="knowledge-calibration-summary">
        <div>
          <span>准确 {accurateCount}</span>
          <span>不完整 {partialCount}</span>
          <span>不相关 {missedCount}</span>
        </div>
        <p>{recommendation}</p>
      </footer>
    </section>
  );
}
