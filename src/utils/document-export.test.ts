import { describe, expect, it } from "vitest";
import { markdownToDocumentHtml } from "./document-export";

describe("printable document rendering", () => {
  it("renders headings, tables and code as readable HTML", () => {
    const html = markdownToDocumentHtml(`# 连接文档

## 主题

| 名称 | Topic |
| --- | --- |
| 数据 | \`sensor/data\` |

\`\`\`json
{"status":"ONLINE"}
\`\`\`
`);

    expect(html).toContain("<h1>连接文档</h1>");
    expect(html).toContain("<table>");
    expect(html).toContain("<code>sensor/data</code>");
    expect(html).toContain("<pre><code>");
  });

  it("removes unsafe markup", () => {
    expect(markdownToDocumentHtml('<script>alert("x")</script>')).not.toContain("<script>");
  });
});
