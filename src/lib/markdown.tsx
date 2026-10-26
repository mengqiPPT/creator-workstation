import type { ReactElement, ReactNode } from "react";

export function renderInlineMarkdown(value: string, keyPrefix: string): ReactNode[] {
  return value
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${keyPrefix}-bold-${index}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={`${keyPrefix}-code-${index}`}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
}

export function renderAiMessageContent(content: string, messageId: string) {
  let inCodeBlock = false;
  return content.split("\n").flatMap((rawLine, index): ReactElement[] => {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      return [];
    }
    if (inCodeBlock) {
      return [<code className="agent-code-line" key={`${messageId}-code-${index}`}>{rawLine || " "}</code>];
    }
    if (!line.trim()) {
      return [<span className="agent-text-break" aria-hidden="true" key={`${messageId}-break-${index}`} />];
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      return [<strong className="agent-text-heading" key={`${messageId}-heading-${index}`}>{renderInlineMarkdown(heading[1], `${messageId}-${index}`)}</strong>];
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      return [<div className="agent-text-list-item" key={`${messageId}-bullet-${index}`}><span aria-hidden="true">•</span><span>{renderInlineMarkdown(bullet[1], `${messageId}-${index}`)}</span></div>];
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      return [<div className="agent-text-list-item" key={`${messageId}-number-${index}`}><span>{numbered[1]}.</span><span>{renderInlineMarkdown(numbered[2], `${messageId}-${index}`)}</span></div>];
    }
    return [<p key={`${messageId}-paragraph-${index}`}>{renderInlineMarkdown(line, `${messageId}-${index}`)}</p>];
  });
}
