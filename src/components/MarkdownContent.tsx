import { memo } from "react";

/**
 * 轻量级 Markdown 渲染组件
 * 支持：**加粗**、*斜体*、`代码`、[链接](url)、有序/无序列表、段落
 */

function parseInline(text: string): string {
  return text
    // 粗体 **text**
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // 斜体 *text*
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // 行内代码 `code`
    .replace(/`(.+?)`/g, "<code class='inline-code'>$1</code>")
    // 链接 [text](url)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

function renderBlocks(content: string): string {
  const blocks = content.split(/\n\n+/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");

      // 检查是否是有序列表（1. xxx \n 2. xxx）
      const isOrderedList = lines.every((line) => /^\d+\.\s/.test(line.trim()));
      if (isOrderedList && lines.length > 0) {
        const items = lines
          .map((line) => line.trim().replace(/^\d+\.\s/, ""))
          .map((item) => `<li>${parseInline(item)}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }

      // 检查是否是无序列表（- xxx 或 * xxx）
      const isUnorderedList = lines.every((line) =>
        /^[-*]\s/.test(line.trim()),
      );
      if (isUnorderedList && lines.length > 0) {
        const items = lines
          .map((line) => line.trim().replace(/^[-*]\s/, ""))
          .map((item) => `<li>${parseInline(item)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      // 普通段落
      return `<p>${parseInline(lines.join("<br/>"))}</p>`;
    })
    .join("");
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
}: {
  content: string;
}) {
  if (!content) return null;
  const html = renderBlocks(content);
  return (
    <div
      className="md-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
