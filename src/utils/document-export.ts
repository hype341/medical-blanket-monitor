function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderInline(value: string): string {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}/.test(line);
}

function tableCells(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * Render the generated Markdown into a safe, print-friendly document.
 */
export function markdownToDocumentHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let codeLines: string[] = [];
  let inCode = false;
  let tableLines: string[] = [];
  let listItems: string[] = [];

  const flushTable = () => {
    if (!tableLines.length) return;
    const rows = tableLines.filter((line) => !isTableSeparator(line)).map(tableCells);
    const [head, ...body] = rows;
    if (head) {
      output.push(
        `<div class="table-wrap"><table><thead><tr>${head
          .map((cell) => `<th>${renderInline(cell)}</th>`)
          .join("")}</tr></thead><tbody>${body
          .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
    }
    tableLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    output.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      flushTable();
      flushList();
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
      }
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.trimStart().startsWith("|")) {
      flushList();
      tableLines.push(line.trim());
      continue;
    }
    flushTable();

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    if (listItem) {
      listItems.push(listItem[1]);
      continue;
    }
    flushList();

    if (line.trim()) output.push(`<p>${renderInline(line)}</p>`);
  }

  flushTable();
  flushList();
  if (inCode && codeLines.length) {
    output.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return output.join("\n");
}

/**
 * Open a print-ready document. The browser print dialog can save it as PDF.
 */
export function printMarkdownDocument(title: string, markdown: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("浏览器阻止了 PDF 导出窗口");

  const body = markdownToDocumentHtml(markdown);
  printWindow.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #173c3a;
      font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
      font-size: 11px;
      line-height: 1.72;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1 { margin: 0 0 20px; font-size: 26px; line-height: 1.2; color: #123e39; }
    h2 { margin: 24px 0 10px; padding-bottom: 6px; font-size: 17px; border-bottom: 1px solid #cdded7; }
    h3 { margin: 18px 0 8px; font-size: 14px; }
    p, ul { margin: 7px 0; }
    ul { padding-left: 20px; }
    code {
      padding: 1px 4px;
      font-family: Consolas, monospace;
      font-size: 9px;
      color: #245d51;
      background: #edf6f2;
      border-radius: 3px;
      overflow-wrap: anywhere;
    }
    pre {
      padding: 12px;
      overflow: hidden;
      color: #dceee8;
      white-space: pre-wrap;
      background: #0b3530;
      border-radius: 5px;
      break-inside: avoid;
    }
    pre code { padding: 0; color: inherit; background: transparent; }
    .table-wrap { margin: 10px 0 16px; overflow: hidden; border: 1px solid #d6e3de; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 7px 8px; text-align: left; border: 1px solid #e0eae6; overflow-wrap: anywhere; }
    th { color: #234f46; background: #edf6f2; }
    tr { break-inside: avoid; }
  </style>
</head>
<body>${body}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 300);
}
