// Turns docs/NOTES.md (Markdown with LaTeX formulas) into HTML for the Theory page.
// It runs at build time in Node (see vite.config.ts), so the browser receives finished HTML
// and only needs KaTeX's stylesheet, not its JavaScript.
//
// Formulas use the notation from design decision A10:
//   $V = R \cdot I$          formula inside a sentence
//   $$ \tau = R \cdot C $$   formula on its own line (also over several lines)

import katex from 'katex';
import MarkdownIt from 'markdown-it';
import type { Env, MarkdownIt as MarkdownParser, StateBlock, StateInline, Token } from 'markdown-it';

export interface TheorySection {
  /** Stable id of the heading, used in links such as theory/#notation-and-units. */
  readonly id: string;
  /** The heading as written in NOTES.md (may contain $...$). */
  readonly title: string;
  /** The heading rendered as HTML (with formulas), for the table of contents. */
  readonly titleHtml: string;
}

export interface RenderedTheory {
  readonly html: string;
  /** The "##" sections in order, for the table of contents. */
  readonly sections: readonly TheorySection[];
}

const DOLLAR = 0x24; // character code of "$"
const BACKSLASH = 0x5c; // character code of "\"
const DIGIT_0 = 0x30;
const DIGIT_9 = 0x39;

export function renderTheory(markdown: string): RenderedTheory {
  const md = createMarkdownParser();
  const env: Env = {};
  const tokens = md.parse(markdown, env);
  removeDocumentTitle(tokens);
  const sections = addHeadingIds(tokens, md, env);
  return { html: md.renderer.render(tokens, md.options, env), sections };
}

/** Numbered list of links to the sections, for the top of the Theory page. */
export function theoryTocHtml(sections: readonly TheorySection[]): string {
  if (sections.length === 0) return '';
  const items = sections.map((section) => `<li><a href="#${section.id}">${section.titleHtml}</a></li>`).join('');
  return `<ol>${items}</ol>`;
}

/**
 * Turns a heading into a URL-friendly id: "Hodgkin–Huxley (HH)" → "hodgkin-huxley-hh".
 * Only a-z, 0-9 and "-" remain, so the id is the same in every browser and easy to type.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD') // split accented letters: "é" → "e" + accent mark
    .replace(/[̀-ͯ]/g, '') // drop the accent marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // spaces, punctuation and symbols → "-"
    .replace(/^-+|-+$/g, ''); // no "-" at the start or end
}

function createMarkdownParser(): MarkdownParser {
  // html: false → HTML written inside the notes is shown as text, never run as part of the page.
  const md = new MarkdownIt({ html: false });
  // The inline rule runs after "escape" (so "\$" stays a plain dollar sign) and before
  // "backticks" (but code spans like `$x$` are still found first, because they start earlier).
  md.inline.ruler.after('escape', 'math_inline', mathInlineRule);
  // "alt": a $$ line may also end a paragraph, list or quote that comes right before it.
  md.block.ruler.before('fence', 'math_block', mathBlockRule, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
  md.renderer.rules.math_inline = (tokens, index) => renderFormula(tokens[index].content, false);
  md.renderer.rules.math_inline_display = (tokens, index) => renderFormula(tokens[index].content, true);
  md.renderer.rules.math_block = (tokens, index) => `${renderFormula(tokens[index].content, true)}\n`;
  return md;
}

/**
 * KaTeX turns LaTeX into HTML (plus MathML, which screen readers can read out).
 * throwOnError: false shows a broken formula in red instead of stopping the build;
 * a test makes sure docs/NOTES.md contains no broken formulas.
 */
function renderFormula(latex: string, displayMode: boolean): string {
  return katex.renderToString(latex, { displayMode, throwOnError: false });
}

/**
 * Formulas inside a line: $...$, or $$...$$ (shown centered on its own line).
 * Same rules as Pandoc for single "$": it must hug the formula ("$x$", not "$ x $"), and a closing
 * "$" followed by a digit doesn't count. So "it costs $5 and $10" stays normal text.
 */
function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src.charCodeAt(start) !== DOLLAR) return false;

  const delimiter = src.charCodeAt(start + 1) === DOLLAR ? '$$' : '$';
  const contentStart = start + delimiter.length;
  const contentEnd = findClosingDelimiter(src, contentStart, state.posMax, delimiter);
  if (contentEnd === -1) return false;
  const latex = src.slice(contentStart, contentEnd);

  if (delimiter === '$') {
    if (latex === '' || latex.trim() !== latex) return false;
    const afterClosing = src.charCodeAt(contentEnd + 1);
    if (afterClosing >= DIGIT_0 && afterClosing <= DIGIT_9) return false;
  } else if (latex.trim() === '') {
    return false;
  }

  // In "silent" mode markdown-it only asks whether a formula starts here; nothing is added.
  if (!silent) {
    const token = state.push(delimiter === '$' ? 'math_inline' : 'math_inline_display', 'math', 0);
    token.content = latex.trim();
    token.markup = delimiter;
  }
  state.pos = contentEnd + delimiter.length;
  return true;
}

/** Position of the next `delimiter` from `from` on (ending before `max`) that isn't written as "\$", or -1. */
function findClosingDelimiter(src: string, from: number, max: number, delimiter: string): number {
  let searchFrom = from;
  for (;;) {
    const found = src.indexOf(delimiter, searchFrom);
    if (found === -1 || found + delimiter.length > max) return -1;
    if (src.charCodeAt(found - 1) !== BACKSLASH) return found;
    searchFrom = found + 1;
  }
}

/**
 * Formulas on their own lines:
 *   $$                        or on one line:   $$ \tau = R \cdot C $$
 *   \tau = R \cdot C
 *   $$
 * Without a closing $$ the lines stay normal text, so a typo can't swallow the rest of the notes.
 */
function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  // Indented by 4 or more spaces, a line is a code block in Markdown, not a formula.
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const firstLine = lineText(state, startLine);
  if (!firstLine.startsWith('$$')) return false;
  const afterOpening = firstLine.slice(2).trimEnd();

  let latex: string;
  let closingLine = startLine;
  if (afterOpening.endsWith('$$')) {
    latex = afterOpening.slice(0, -2);
  } else {
    // "$$x$$ and more text" is not a block of its own; the inline rule handles it.
    if (afterOpening.includes('$$')) return false;
    const lines = [afterOpening];
    let closed = false;
    for (let line = startLine + 1; line < endLine; line++) {
      // A less indented line has left the surrounding block (e.g. a list item).
      if (state.sCount[line] < state.blkIndent && !state.isEmpty(line)) break;
      const text = lineText(state, line).trimEnd();
      if (text.endsWith('$$')) {
        lines.push(text.slice(0, -2));
        closingLine = line;
        closed = true;
        break;
      }
      lines.push(text);
    }
    if (!closed) return false;
    latex = lines.join('\n');
  }
  if (latex.trim() === '') return false;
  if (silent) return true;

  const token = state.push('math_block', 'math', 0);
  token.block = true;
  token.content = latex.trim();
  token.markup = '$$';
  token.map = [startLine, closingLine + 1];
  state.line = closingLine + 1;
  return true;
}

/** Text of one source line, without the indentation markdown-it has already accounted for. */
function lineText(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]);
}

/** NOTES.md starts with a "# ..." title, but the Theory page has its own <h1>, so it is dropped. */
function removeDocumentTitle(tokens: Token[]): void {
  if (tokens[0]?.type === 'heading_open' && tokens[0].tag === 'h1') {
    tokens.splice(0, 3); // heading_open, inline (the title text), heading_close
  }
}

/**
 * Gives every "##" and "###" heading an id made from its text ("Notation and units" →
 * "notation-and-units"), so other pages can link to it. Repeated titles get "-2", "-3", ...
 * Returns the "##" headings for the table of contents.
 */
function addHeadingIds(tokens: Token[], md: MarkdownParser, env: Env): TheorySection[] {
  const usedIds = new Set<string>();
  const sections: TheorySection[] = [];
  tokens.forEach((token, index) => {
    if (token.type !== 'heading_open' || (token.tag !== 'h2' && token.tag !== 'h3')) return;
    const inline = tokens[index + 1]; // the heading's text comes right after heading_open
    const baseId = slugify(inline.content) || 'section';
    let id = baseId;
    for (let copy = 2; usedIds.has(id); copy++) id = `${baseId}-${copy}`;
    usedIds.add(id);
    token.attrSet('id', id);
    if (token.tag === 'h2') {
      const titleHtml = md.renderer.renderInline(inline.children ?? [], md.options, env);
      sections.push({ id, title: inline.content, titleHtml });
    }
  });
  return sections;
}
