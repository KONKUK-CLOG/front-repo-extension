function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(markdown: string): string {
  const codeTokens: string[] = [];

  let html = escapeHtml(markdown)
    .replace(/`([^`]+)`/g, (_, code: string) => {
      const token = `@@CODE_${codeTokens.length}@@`;
      codeTokens.push(`<code>${code}</code>`);
      return token;
    })
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+|mailto:[^)]+|\/[^)]+|#[^)]+)\)/g,
      (_match, label: string, href: string) => {
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`;
      },
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>");

  codeTokens.forEach((tokenHtml, index) => {
    html = html.replace(`@@CODE_${index}@@`, tokenHtml);
  });

  return html;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    const fencedCodeMatch = line.match(/^```(\w+)?\s*$/);
    if (fencedCodeMatch) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }

      blocks.push(
        `<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push("<hr />");
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      index -= 1;
      blocks.push(
        `<blockquote>${renderInline(quoteLines.join(" "))}</blockquote>`,
      );
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }

      index -= 1;
      blocks.push(
        `<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      index -= 1;
      blocks.push(
        `<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`,
      );
      continue;
    }

    const paragraphLines: string[] = [line];
    while (
      index + 1 < lines.length &&
      lines[index + 1].trim() &&
      !/^```\s*$/.test(lines[index + 1]) &&
      !/^(#{1,6})\s+/.test(lines[index + 1]) &&
      !/^>\s?/.test(lines[index + 1]) &&
      !/^\s*[-*+]\s+/.test(lines[index + 1]) &&
      !/^\s*\d+\.\s+/.test(lines[index + 1]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index + 1])
    ) {
      index += 1;
      paragraphLines.push(lines[index]);
    }

    blocks.push(`<p>${renderInline(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("\n");
}
