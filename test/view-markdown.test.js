// test/view-markdown.test.js
//
// The dependency-free markdown renderer that `conductor view` uses at
// GENERATION time (never in the browser, so the page carries no parser).
//
// The security tests are the important ones. `conductor/` holds text written by
// the human, by agents, and — via the inbox — by whatever the human pasted in.
// The generated page is opened from `file://`, an origin with more local reach
// than a website, so the renderer must NEVER pass raw HTML through and must
// never emit a `javascript:` URL. Escaping is the whole contract.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  renderInline,
  renderMarkdown,
  extractHeadings,
  documentTitle,
  slugifyHeading,
} from "../src/view/markdown.js";

describe("escaping (the security contract)", () => {
  test("escapes the five dangerous characters", () => {
    assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });

  test("raw HTML in markdown is rendered as text, never passed through", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n');
    assert.ok(!html.includes("<script>"), "a script tag must not survive");
    assert.ok(html.includes("&lt;script&gt;"), "it must appear as visible text");
  });

  test("an img onerror payload cannot escape", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">\n');
    // The text may still READ "onerror=" — what must not exist is a live tag.
    assert.ok(!/<img/i.test(html), html);
    assert.ok(html.includes("&lt;img"), html);
  });

  test("javascript: links are neutralised", () => {
    const html = renderInline("[click](javascript:alert(1))");
    assert.ok(!html.toLowerCase().includes("javascript:"), html);
    assert.ok(html.includes('href="#"'), html);
  });

  test("a normal link and an autolink both work", () => {
    assert.ok(renderInline("[docs](./spec.md)").includes('href="./spec.md"'));
    assert.ok(renderInline("<https://example.com>").includes('href="https://example.com"'));
  });
});

describe("inline formatting", () => {
  test("bold, italic, strikethrough and code", () => {
    assert.ok(renderInline("**b**").includes("<strong>b</strong>"));
    assert.ok(renderInline("*i*").includes("<em>i</em>"));
    assert.ok(renderInline("~~s~~").includes("<del>s</del>"));
    assert.ok(renderInline("`c`").includes("<code>c</code>"));
  });

  test("markdown inside a code span stays literal", () => {
    const html = renderInline("`**not bold**`");
    assert.ok(html.includes("<code>**not bold**</code>"), html);
    assert.ok(!html.includes("<strong>"), html);
  });

  test("bold wins over italic on the same run", () => {
    const html = renderInline("**both**");
    assert.ok(html.includes("<strong>both</strong>"), html);
    assert.ok(!html.includes("<em>"), html);
  });
});

describe("block structure", () => {
  test("headings get stable slug ids", () => {
    const html = renderMarkdown("## Why This Matters\n");
    assert.match(html, /<h2 id="why-this-matters">Why This Matters<\/h2>/);
  });

  test("paragraphs, lists and nesting", () => {
    const html = renderMarkdown("hello\n\n- one\n- two\n  - deep\n");
    assert.ok(html.includes("<p>hello</p>"), html);
    assert.equal((html.match(/<ul>/g) ?? []).length, 2, "one nested list");
    assert.ok(html.includes("<li>deep</li>"), html);
  });

  test("ordered lists", () => {
    const html = renderMarkdown("1. first\n2. second\n");
    assert.ok(html.includes("<ol>"), html);
  });

  test("task list items render as real checkboxes, disabled", () => {
    const html = renderMarkdown("- [ ] open thing\n- [x] done thing\n");
    assert.ok(html.includes("disabled"), "must not be clickable — the file is the source of truth");
    assert.ok(html.includes("checked"), html);
    assert.ok(html.includes("task-done"), "a done item is marked so CSS can strike it");
  });

  test("fenced code keeps its language and escapes its body", () => {
    const html = renderMarkdown("```js\nconst a = 1 < 2;\n```\n");
    assert.ok(html.includes('class="lang-js"'), html);
    assert.ok(html.includes("1 &lt; 2"), html);
  });

  test("markdown inside a fence is not interpreted", () => {
    const html = renderMarkdown("```\n# not a heading\n- not a list\n```\n");
    assert.ok(!html.includes("<h1"), html);
    assert.ok(!html.includes("<li>"), html);
  });

  test("pipe tables render as tables with a header row", () => {
    const html = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |\n");
    assert.ok(html.includes("<table>"), html);
    assert.ok(html.includes("<th>A</th>"), html);
    assert.ok(html.includes("<td>1</td>"), html);
  });

  test("a table is wrapped so it can scroll instead of breaking the layout", () => {
    const html = renderMarkdown("| A |\n|---|\n| 1 |\n");
    assert.ok(html.includes("table-wrap"), html);
  });

  test("blockquotes and horizontal rules", () => {
    assert.ok(renderMarkdown("> quoted\n").includes("<blockquote>"));
    assert.ok(renderMarkdown("---\n").includes("<hr>"));
  });

  test("GitHub alerts become styled callouts", () => {
    const html = renderMarkdown("> [!WARNING]\n> be careful\n");
    assert.ok(html.includes("callout"), html);
    assert.ok(html.includes("callout-warning"), html);
    assert.ok(html.includes("be careful"), html);
    assert.ok(!html.includes("[!WARNING]"), "the marker itself is not content");
  });

  test("YAML frontmatter is stripped, not rendered", () => {
    const html = renderMarkdown("---\ntrigger: always_on\n---\n\nbody\n");
    assert.ok(!html.includes("always_on"), html);
    assert.ok(html.includes("<p>body</p>"), html);
  });
});

describe("document metadata", () => {
  test("headings are extracted in order with levels", () => {
    const hs = extractHeadings("# Title\n\n## One\n\n### Deep\n\n## Two\n");
    assert.deepEqual(
      hs.map((h) => [h.level, h.text]),
      [
        [1, "Title"],
        [2, "One"],
        [3, "Deep"],
        [2, "Two"],
      ]
    );
    assert.equal(hs[1].id, "one");
  });

  test("headings inside a fence are not extracted", () => {
    assert.equal(extractHeadings("```\n# fake\n```\n").length, 0);
  });

  test("the title comes from the first h1, else from the filename", () => {
    assert.equal(documentTitle("# Real Title\n", "some-file.md"), "Real Title");
    assert.equal(documentTitle("no heading\n", "north-star.md"), "North Star");
  });

  test("duplicate headings get unique ids", () => {
    const hs = extractHeadings("## Same\n\n## Same\n");
    assert.notEqual(hs[0].id, hs[1].id);
  });

  test("slugify strips punctuation and collapses spaces", () => {
    assert.equal(slugifyHeading("P1 — High Priority (Do Next)"), "p1-high-priority-do-next");
  });
});
