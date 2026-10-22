// Every "How does this work?" link on a page must point to a section that exists in the
// Theory notes; a renamed heading in docs/NOTES.md would otherwise silently break the link.

import { describe, expect, it } from 'vitest';
import notes from '../../docs/NOTES.md?raw';
import { renderTheory } from './theory-render.ts';

const pages = import.meta.glob<string>(['../../**/index.html', '!../../dist/**', '!../../node_modules/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const theoryIds = new Set([...renderTheory(notes).html.matchAll(/<h[23] id="([^"]+)"/g)].map((match) => match[1]));

describe('links to the Theory page', () => {
  it('finds the page HTML files', () => {
    expect(Object.keys(pages).length).toBeGreaterThanOrEqual(6);
  });

  for (const [file, html] of Object.entries(pages)) {
    const targets = [...html.matchAll(/theory\/#([\w-]+)/g)].map((match) => match[1]);
    if (targets.length === 0) continue;
    it(`${file.replace('../../', '')}: all ${targets.length} theory link(s) exist`, () => {
      for (const id of targets) expect(theoryIds, `missing section #${id}`).toContain(id);
    });
  }
});
