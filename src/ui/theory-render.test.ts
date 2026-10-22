import { describe, expect, it } from 'vitest';
import notes from '../../docs/NOTES.md?raw';
import { renderTheory, slugify, theoryTocHtml } from './theory-render.ts';

/** How often `part` occurs in `text`. */
function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

describe('renderTheory: formulas', () => {
  it('renders $...$ inside a sentence with KaTeX', () => {
    const { html } = renderTheory('Ohm: $V = R I$.');
    expect(count(html, 'class="katex"')).toBe(1);
    expect(html).not.toContain('katex-display');
    expect(html).not.toContain('$V');
  });

  it('keeps underscores in formulas away from Markdown (no accidental italics)', () => {
    const { html } = renderTheory('Rest $V_{rest}$ and input $I_{ext}$ here.');
    expect(html).not.toContain('<em>');
    expect(count(html, 'class="katex"')).toBe(2);
  });

  it('renders a $$ block over several lines as a display formula', () => {
    const { html } = renderTheory('Text\n\n$$\n\\tau = R \\cdot C\n$$\n\nMore');
    expect(count(html, 'katex-display')).toBe(1);
    expect(html).toContain('<p>Text</p>');
    expect(html).toContain('<p>More</p>');
  });

  it('renders a one-line $$ formula $$ block', () => {
    const { html } = renderTheory('$$ E = m c^2 $$');
    expect(count(html, 'katex-display')).toBe(1);
  });

  it('lets a $$ block end the paragraph right before it', () => {
    const { html } = renderTheory('Text\n$$\nx\n$$');
    expect(html).toContain('<p>Text</p>');
    expect(count(html, 'katex-display')).toBe(1);
  });

  it('leaves dollar signs in code and in prices alone', () => {
    const { html } = renderTheory('Write `$x$` or `$$x$$` for math. It costs $5 and $10.');
    expect(html).toContain('<code>$x$</code>');
    expect(html).toContain('<code>$$x$$</code>');
    expect(html).toContain('costs $5 and $10.');
    expect(html).not.toContain('katex');
  });

  it('treats \\$ as a plain dollar sign', () => {
    const { html } = renderTheory('Escaped \\$x\\$ here.');
    expect(html).toContain('$x$');
    expect(html).not.toContain('katex');
  });

  it('keeps an unclosed $$ block as normal text instead of swallowing the rest', () => {
    const { html } = renderTheory('$$\nx\n\n## Next section');
    expect(html).not.toContain('katex');
    expect(html).toContain('<h2 id="next-section">');
  });

  it('marks broken formulas with katex-error (so the NOTES.md test below can detect them)', () => {
    const { html } = renderTheory('$\\frac{1}$');
    expect(html).toContain('katex-error');
  });
});

describe('renderTheory: headings and safety', () => {
  it('drops the "#" title, gives "##"/"###" stable ids and lists "##" sections', () => {
    const { html, sections } = renderTheory('# Title\n\n## Notation and units\n\n### Ohm\n\n## Notation and units\n');
    expect(html).not.toContain('<h1');
    expect(html).toContain('<h2 id="notation-and-units">');
    expect(html).toContain('<h3 id="ohm">');
    expect(html).toContain('<h2 id="notation-and-units-2">');
    expect(sections.map((section) => section.id)).toEqual(['notation-and-units', 'notation-and-units-2']);
  });

  it('builds the table of contents with links to the sections', () => {
    const { sections } = renderTheory('## The membrane $\\tau$\n');
    const toc = theoryTocHtml(sections);
    expect(toc).toContain('href="#the-membrane-tau"');
    expect(toc).toContain('class="katex"');
    expect(theoryTocHtml([])).toBe('');
  });

  it('shows HTML written in the notes as text instead of running it', () => {
    const { html } = renderTheory('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('slugify', () => {
  it('turns headings into simple ids', () => {
    expect(slugify('Notation and units')).toBe('notation-and-units');
    expect(slugify('Hodgkin–Huxley (HH)')).toBe('hodgkin-huxley-hh');
    expect(slugify('Café: résumé!')).toBe('cafe-resume');
    expect(slugify('  --  ')).toBe('');
  });
});

describe('docs/NOTES.md', () => {
  it('renders without broken formulas and has sections', () => {
    const { html, sections } = renderTheory(notes);
    expect(sections.length).toBeGreaterThan(0);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('katex-error');
  });
});
